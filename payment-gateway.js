import { getZynlePaymentStatus, initiateZynlePayment, zynlepayConfig } from './zynlepay.js';

export { PaymentError } from './zynlepay.js';
export const paymentConfig = zynlepayConfig;

export function createZynlepayGateway({ env = () => process.env, fetcher = fetch } = {}) {
  const config = () => zynlepayConfig(env());
  const options = { config, fetchImpl: fetcher };
  return {
    config,
    async initiate(order) {
      const response = await initiateZynlePayment({ reference: order.reference,
        phone: order.details.phone, total: Number(order.amount_cents) / 100 }, options);
      return {
        reference: order.reference, status: 'pending', confirmationAvailable: false,
        ...(/^\d{1,6}$/.test(String(response.response_code)) ? { gatewayCode: String(response.response_code) } : {}),
        ...(String(response.response_code) === '120' && /^\d{1,30}$/.test(String(response.transaction_id))
          ? { transactionId: String(response.transaction_id) } : {}),
      };
    },
    verify: order => getZynlePaymentStatus({ reference: order.reference }, options),
  };
}
