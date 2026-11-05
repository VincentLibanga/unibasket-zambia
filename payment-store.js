import { queryDatabase } from './db.js';

export function createPaymentStore({ query = queryDatabase } = {}) {
  const one = async (sql, parameters) => (await query(sql, parameters)).rows[0] || null;
  return {
    findByKey: hash => one('SELECT * FROM public.payment_orders WHERE request_hash = $1', [hash]),
    findByReference: reference => one('SELECT * FROM public.payment_orders WHERE reference = $1', [reference]),
    products: ids => query('SELECT id, name, price, stock_quantity FROM public.products WHERE id = ANY($1::bigint[]) AND is_active = TRUE', [ids]).then(result => result.rows),
    async insert(order) {
      await query(`INSERT INTO public.payment_orders (reference, request_hash, fingerprint, mode, details, amount_cents)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6) ON CONFLICT (request_hash) DO NOTHING`,
      [order.reference, order.request_hash, order.fingerprint, order.mode, JSON.stringify(order.details), order.amount_cents]);
      return one('SELECT * FROM public.payment_orders WHERE request_hash = $1', [order.request_hash]);
    },
    claimCheckout: reference => one(`UPDATE public.payment_orders SET initialization = 'starting'
      WHERE reference = $1 AND initialization = 'new' RETURNING reference`, [reference]),
    saveGatewayState: (reference, state) => query(`UPDATE public.payment_orders
      SET initialization = 'ready', details = details || $2::jsonb,
      transaction_id = COALESCE($3, transaction_id) WHERE reference = $1`,
    [reference, JSON.stringify({ gatewayCode: state.gatewayCode, confirmationAvailable: state.confirmationAvailable }), state.transactionId || null]),
    uncertainCheckout: reference => query("UPDATE public.payment_orders SET initialization = 'uncertain' WHERE reference = $1", [reference]),
    rejectCheckout: (reference, error) => query(`UPDATE public.payment_orders SET payment_status = 'failed', initialization = 'uncertain',
      details = details || $2::jsonb WHERE reference = $1 AND payment_status <> 'paid'`,
    [reference, JSON.stringify({ failureCode: error.code, failureMessage: error.message })]),
    recordVerification: (reference, status, transactionId) => one(`UPDATE public.payment_orders
      SET payment_status = $2, transaction_id = $3, verified_at = CURRENT_TIMESTAMP
      WHERE reference = $1 AND payment_status <> 'paid' RETURNING *`, [reference, status, transactionId]),
    claimReceipt: reference => one(`UPDATE public.payment_orders SET receipt_sending_at = CURRENT_TIMESTAMP
      WHERE reference = $1 AND payment_status = 'paid' AND receipt_sent_at IS NULL
      AND (receipt_sending_at IS NULL OR receipt_sending_at < CURRENT_TIMESTAMP - INTERVAL '2 minutes') RETURNING reference`, [reference]),
    receiptSent: reference => query('UPDATE public.payment_orders SET receipt_sent_at = CURRENT_TIMESTAMP, receipt_sending_at = NULL WHERE reference = $1', [reference]),
    releaseReceipt: reference => query('UPDATE public.payment_orders SET receipt_sending_at = NULL WHERE reference = $1', [reference]),
  };
}
