// Hosted checkout keeps card details and mobile-money PINs on the provider's page.
const PAYMENT_STORE = 'unibasket.payment.pending.v1';
let paymentConfigState = { available: false, mode: 'test' };
let paymentBusy = false;
let pendingPayment = readOnlinePayment();

function readOnlinePayment() {
  try {
    const value = JSON.parse(sessionStorage.getItem(PAYMENT_STORE));
    return value && typeof value.idempotencyKey === 'string' && Array.isArray(value.details?.items) ? value : null;
  } catch { return null; }
}

function saveOnlinePayment() {
  // Refuse to leave this page if the return flow cannot recover its private key.
  sessionStorage.setItem(PAYMENT_STORE, JSON.stringify(pendingPayment));
}

function hasPendingOnlinePayment() { return Boolean(pendingPayment && !pendingPayment.settled); }
function onlinePaymentIsBusy() { return paymentBusy; }

function updateOnlinePaymentButton() {
  const button = document.getElementById('onlinePaymentSubmit');
  button.disabled = !paymentConfigState.available || checkoutBusy || paymentBusy || Boolean(pendingOrder);
  button.textContent = paymentBusy ? 'Preparing payment…' : paymentConfigState.mode === 'test' ? 'Pay online · Test mode' : 'Pay online';
  document.getElementById('onlinePaymentNote').textContent = paymentConfigState.available
    ? paymentConfigState.mode === 'test'
      ? 'Test payment through Flutterwave. No real money is collected in test mode.'
      : 'Pay securely through Flutterwave. Available methods are shown on its payment page.'
    : 'Online payment is currently unavailable. You can place an unpaid order by email below.';
}

function syncPaymentBasket() {
  if (!hasPendingOnlinePayment()) return;
  document.getElementById('basketFooter').hidden = false;
  document.getElementById('basketCheckout').disabled = false;
  document.getElementById('basketCheckout').textContent = 'Resume payment';
  document.getElementById('basketDeliveryNote').textContent = 'Check your existing payment before starting another.';
  if (pendingPayment.result) {
    document.getElementById('basketTotalLabel').textContent = 'Payment total';
    document.getElementById('subtotal').textContent = 'ZMW ' + pendingPayment.result.total.toFixed(2);
  }
}

async function paymentApi(path, body) {
  const response = await fetch('/api/payments' + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + pendingPayment.idempotencyKey },
    body: JSON.stringify(body || {}), signal: AbortSignal.timeout(45000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error?.message || 'Payment status is unavailable. Please check again.');
    error.code = payload.error?.code;
    throw error;
  }
  const result = payload.data;
  if (!/^UBP-[A-F\d]{32}$/.test(result?.reference || '') ||
      (pendingPayment.reference && result.reference !== pendingPayment.reference) ||
      !['pending', 'failed', 'paid'].includes(result.paymentStatus) || !['test', 'live'].includes(result.mode) ||
      !Number.isFinite(result.total) || result.total <= 0 || result.currency !== 'ZMW') {
    throw new Error('The payment result could not be verified. Please check again.');
  }
  return result;
}

async function submitOnlinePayment() {
  if (paymentBusy || checkoutBusy || pendingOrder) return;
  if (hasPendingOnlinePayment()) { await resumeOnlinePayment(); return; }
  if (!currentUser) { navigateTo('account'); accountError('Sign in before paying for an order.'); return; }
  if (!document.getElementById('checkoutForm').reportValidity()) return;
  if (!cart.length) return;
  pendingPayment = {
    idempotencyKey: crypto.randomUUID(),
    details: {
      name: currentUser.name, email: currentUser.email,
      deliveryMethod: document.getElementById('deliveryMethod').value,
      deliveryNote: document.getElementById('deliveryNote').value,
      items: cart.map(item => ({ id: products[item.i][7], quantity: item.q })),
    },
  };
  try { saveOnlinePayment(); }
  catch {
    pendingPayment = null;
    const error = document.getElementById('checkoutError');
    error.hidden = false;
    error.textContent = 'Allow session storage in this browser to continue with online payment.';
    return;
  }
  await startSavedOnlinePayment();
}

async function startSavedOnlinePayment() {
  if (paymentBusy) return;
  paymentBusy = true;
  setCheckoutBusy(true);
  try {
    const result = await paymentApi('/initiate', { ...pendingPayment.details, idempotencyKey: pendingPayment.idempotencyKey });
    pendingPayment.reference = result.reference;
    pendingPayment.result = result;
    saveOnlinePayment();
    if (result.paymentStatus === 'pending' && result.checkoutUrl) continueOnlinePayment();
    else showOnlinePayment(result);
  } catch (error) {
    // Validation failures have not created a charge and can be corrected safely.
    if (['INVALID_ORDER_DETAILS', 'INVALID_PAYMENT_ITEMS', 'PRODUCT_UNAVAILABLE', 'PAYMENT_NOT_CONFIGURED'].includes(error.code)) {
      pendingPayment = null;
      sessionStorage.removeItem(PAYMENT_STORE);
      document.getElementById('checkoutError').hidden = false;
      document.getElementById('checkoutError').textContent = error.message;
    } else showPaymentUncertainty(error.message);
  } finally {
    paymentBusy = false;
    setCheckoutBusy(false);
    renderBasket();
  }
}

function continueOnlinePayment() {
  const value = pendingPayment?.result?.checkoutUrl;
  let url;
  try { url = new URL(value); } catch { return; }
  if (url.protocol !== 'https:' || url.hostname !== 'checkout.flutterwave.com' || url.username || url.password || url.port) {
    showPaymentUncertainty('The payment address could not be verified. Check payment status.');
    return;
  }
  saveOnlinePayment();
  window.location.assign(url.href);
}

function openPaymentResult() {
  closeBasket();
  document.getElementById('checkoutModal').hidden = false;
  document.body.classList.add('shopping-open');
  document.getElementById('checkoutForm').hidden = true;
  document.getElementById('checkoutSuccess').hidden = false;
  document.getElementById('confirmationHeading').textContent = 'Payment status';
  document.getElementById('confirmationName').textContent = 'Your online payment';
  document.getElementById('confirmationIcon').textContent = '…';
  document.getElementById('paymentActions').hidden = false;
  document.getElementById('resumePaymentButton').hidden = true;
  document.getElementById('newPaymentButton').hidden = true;
  document.getElementById('checkPaymentButton').disabled = paymentBusy;
}

function showPaymentUncertainty(message) {
  openPaymentResult();
  document.getElementById('confirmationDescription').textContent = message || 'Your payment has not been confirmed. Check its status before making another payment.';
  document.getElementById('orderPaymentStatus').textContent = 'Not confirmed';
  document.getElementById('orderId').textContent = pendingPayment?.reference || 'Checking order reference';
  document.getElementById('orderTotal').textContent = pendingPayment?.result ? 'ZMW ' + pendingPayment.result.total.toFixed(2) : 'Awaiting confirmation';
  document.getElementById('receiptStatus').textContent = '';
  document.getElementById('confirmationPaymentNote').textContent = 'Your basket is kept until payment is verified. Use Check payment status to continue.';
}

function showOnlinePayment(result) {
  openPaymentResult();
  const paid = result.paymentStatus === 'paid';
  const failed = result.paymentStatus === 'failed';
  pendingPayment.result = result;
  document.getElementById('confirmationIcon').textContent = paid ? '✓' : failed ? '×' : '…';
  document.getElementById('orderId').textContent = result.reference;
  document.getElementById('orderTotal').textContent = 'ZMW ' + result.total.toFixed(2);
  document.getElementById('orderPaymentStatus').textContent = (paid ? 'Paid' : failed ? 'Failed' : 'Pending') + (result.mode === 'test' ? ' (test)' : '');
  document.getElementById('confirmationDescription').textContent = paid
    ? 'Your payment has been verified. Keep your order reference for your records.'
    : failed ? 'This payment attempt did not complete. Your basket is kept.'
      : 'Your payment is awaiting confirmation. Check its status before starting another payment.';
  document.getElementById('receiptStatus').textContent = paid
    ? result.emailSent ? 'A paid order receipt has been emailed to ' + result.email + '.' : 'Payment is confirmed. The receipt email is pending; check again to retry delivery.'
    : '';
  document.getElementById('confirmationPaymentNote').textContent = result.mode === 'test'
    ? 'Test transaction. No real money was collected.' : paid ? 'Payment confirmed through Flutterwave.' : 'You can return here to check payment status.';
  document.getElementById('resumePaymentButton').hidden = paid || failed || !result.checkoutUrl;
  document.getElementById('newPaymentButton').hidden = !failed;
  if (paid && !pendingPayment.settled) {
    cart = cart.flatMap(item => {
      const ordered = result.items.find(line => line.id === products[item.i][7]);
      const quantity = Math.max(0, item.q - (ordered?.quantity || 0));
      return quantity ? [{ ...item, q: quantity }] : [];
    });
    pendingPayment.settled = true;
    updateCartBadge();
  }
  saveOnlinePayment();
}

async function checkOnlinePayment() {
  if (!pendingPayment || paymentBusy) return;
  if (!pendingPayment.reference) { await startSavedOnlinePayment(); return; }
  paymentBusy = true;
  document.getElementById('checkPaymentButton').disabled = true;
  try { showOnlinePayment(await paymentApi('/' + encodeURIComponent(pendingPayment.reference) + '/verify')); }
  catch (error) { showPaymentUncertainty(error.message); }
  finally {
    paymentBusy = false;
    document.getElementById('checkPaymentButton').disabled = false;
    renderBasket();
  }
}

async function resumeOnlinePayment() {
  if (!pendingPayment) return;
  closeBasket();
  showPaymentUncertainty('Checking your payment…');
  await checkOnlinePayment();
}

function finishFailedPayment() {
  if (pendingPayment?.result?.paymentStatus !== 'failed' || paymentBusy) return;
  if (!cart.length) {
    cart = pendingPayment.details.items.flatMap(item => {
      const index = products.findIndex(product => product[7] === item.id);
      return index < 0 ? [] : [{ i: index, q: item.quantity }];
    });
  }
  pendingPayment = null;
  sessionStorage.removeItem(PAYMENT_STORE);
  closeCheckout();
  navigateTo('basket');
}

function resetPaymentConfirmation() {
  document.getElementById('confirmationIcon').textContent = '✓';
  document.getElementById('confirmationHeading').textContent = 'Order confirmed';
  document.getElementById('confirmationDescription').textContent = 'Your order receipt has been sent by email. Keep the reference below for your records.';
  document.getElementById('confirmationPaymentNote').textContent = 'No payment was collected. This receipt is an order confirmation.';
  document.getElementById('paymentActions').hidden = true;
}

async function loadPaymentConfiguration() {
  try {
    const response = await fetch('/api/payments/config');
    if (response.ok) paymentConfigState = (await response.json()).data;
  } catch { /* Unpaid checkout remains available when online payment is unavailable. */ }
  updateOnlinePaymentButton();
}

loadPaymentConfiguration();
renderBasket();
if (new URLSearchParams(window.location.search).get('payment_return') === '1') {
  // Query-string status and transaction IDs are never treated as proof of payment.
  history.replaceState({}, '', './');
  if (pendingPayment) resumeOnlinePayment();
  else showPaymentUncertainty('Open this payment in the browser tab where you started checkout. Your order reference is available from Flutterwave.');
}
