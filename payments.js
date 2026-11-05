import { randomBytes, timingSafeEqual } from "node:crypto";

import {
  getZynlePaymentStatus,
  initiateZynlePayment,
  normalizeMobileNumber,
  zynlepayConfig,
  isZynleCallbackConfigured,
  parseZynlePaymentCallback,
  PaymentError,
} from "./zynlepay.js";

export const PAYMENT_METHODS = { mobile_money: "Mobile money" };
export const DELIVERY_METHODS = {
  campus: { label: "Campus drop-off", charge: 25 },
  pickup: { label: "Collection point", charge: 0 },
  courier: { label: "City courier", charge: 50 },
};

function invalid(message) {
  throw new PaymentError("INVALID_PAYMENT_DETAILS", message);
}

function checkoutDetails(input) {
  const {
    email,
    name,
    phone,
    paymentMethod,
    deliveryMethod,
    deliveryNote,
    items,
  } = input || {};
  if (
    typeof email !== "string" ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  )
    invalid("Sign in with a valid email address before paying.");
  if (
    typeof name !== "string" ||
    name.trim().length < 2 ||
    name.trim().length > 80
  )
    invalid("Enter your full name before placing the order.");
  const mobileNumber = normalizeMobileNumber(phone);
  if (!Object.hasOwn(PAYMENT_METHODS, paymentMethod))
    invalid("Choose a payment method.");
  if (!Object.hasOwn(DELIVERY_METHODS, deliveryMethod))
    invalid("Choose a delivery method.");
  if (!Array.isArray(items) || items.length === 0 || items.length > 100)
    invalid("Your basket is empty or too large.");
  const lines = items.map((item) => {
    const quantity = item?.quantity;
    const price = item?.price;
    // Browser-only seller listings are supported for sandbox demonstrations only.
    // Live checkout requires a server-owned catalogue and authenticated accounts.
    if (
      typeof item?.name !== "string" ||
      !item.name.trim() ||
      item.name.length > 160 ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 99 ||
      typeof price !== "number" ||
      !Number.isFinite(price) ||
      price <= 0 ||
      price > 100000 ||
      Math.abs(price * 100 - Math.round(price * 100)) > 0.000001
    )
      invalid(
        "One of the basket items is not valid. Refresh the page and try again.",
      );
    return {
      name: item.name.trim(),
      quantity,
      price,
      lineTotal: (Math.round(price * 100) * quantity) / 100,
    };
  });
  const subtotal =
    lines.reduce((sum, line) => sum + Math.round(line.lineTotal * 100), 0) /
    100;
  const delivery = DELIVERY_METHODS[deliveryMethod];
  return {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: mobileNumber,
    lines,
    deliveryMethod: delivery.label,
    deliveryCharge: delivery.charge,
    deliveryNote:
      typeof deliveryNote === "string" ? deliveryNote.trim().slice(0, 200) : "",
    subtotal,
    total: (Math.round(subtotal * 100) + delivery.charge * 100) / 100,
    paymentMethod: PAYMENT_METHODS[paymentMethod],
  };
}

export function createPaymentService({
  initiatePayment = initiateZynlePayment,
  config = zynlepayConfig,
  getStatus = getZynlePaymentStatus,
  callbacksEnabled = isZynleCallbackConfigured,
  sendReceipt,
  now = Date.now,
  onMailError = (error) =>
    console.error(
      "[mail] ZynlePay receipt could not be sent:",
      error.code || error.name,
    ),
} = {}) {
  const orders = new Map();
  const lifetime = 24 * 60 * 60 * 1000;

  function create(input) {
    config();
    const details = checkoutDetails(input);
    for (const [key, order] of orders)
      if (order.createdAt + lifetime < now()) orders.delete(key);
    if (orders.size >= 1000)
      throw new PaymentError(
        "PAYMENT_BUSY",
        "Test checkout is busy. Please try again later.",
        503,
      );
    const reference = `UBZ-${randomBytes(16).toString("hex").toUpperCase()}`;
    const token = randomBytes(32).toString("hex");
    const order = {
      ...details,
      reference,
      token,
      createdAt: now(),
      phase: "created",
      result: null,
      initiating: null,
      verifying: null,
      settling: null,
      callbackCollection: null,
    };
    orders.set(reference, order);
    return {
      reference,
      token,
      email: details.email,
      name: details.name,
      amount: details.total,
      currency: "ZMW",
      status: "created",
    };
  }

  function find(reference) {
    const order = orders.get(reference);
    if (!order || order.createdAt + lifetime < now()) {
      orders.delete(reference);
      throw new PaymentError(
        "PAYMENT_NOT_FOUND",
        "This test checkout has expired or the server restarted. Check your ZynlePay sandbox dashboard before trying again.",
        404,
      );
    }
    return order;
  }

  function authorized(reference, token) {
    const order = find(reference);
    if (
      typeof token !== "string" ||
      !/^[a-f0-9]{64}$/.test(token) ||
      !timingSafeEqual(
        Buffer.from(token, "hex"),
        Buffer.from(order.token, "hex"),
      )
    ) {
      throw new PaymentError(
        "PAYMENT_NOT_FOUND",
        "This payment could not be found.",
        404,
      );
    }
    return order;
  }

  function state(order) {
    return (
      order.result || {
        status: order.phase === "created" ? "created" : "pending",
        confirmationAvailable:
          callbacksEnabled() || (order.confirmationAvailable ?? Boolean(getStatus)),
        ...(order.gatewayCode ? { gatewayCode: order.gatewayCode } : {}),
        ...(order.gatewayTransactionId
          ? { paymentRef: order.gatewayTransactionId }
          : {}),
      }
    );
  }

  async function initiate(reference, token) {
    const order = authorized(reference, token);
    if (order.settling) return order.settling;
    if (order.initiating) return order.initiating;
    if (order.phase !== "created") return state(order);
    order.phase = "submitting";
    order.initiating = (async () => {
      try {
        // A submitted request is not proof of payment, regardless of HTTP status.
        const response = await initiatePayment(order);
        if (order.settling) return order.settling;
        if (order.result) return order.result;
        if (/^\d{1,6}$/.test(String(response?.response_code || "")))
          order.gatewayCode = String(response.response_code);
        if (
          order.gatewayCode === "120" &&
          /^\d{1,30}$/.test(String(response?.transaction_id || ""))
        ) {
          order.gatewayTransactionId = String(response.transaction_id);
        }
        order.phase = "pending";
        return state(order);
      } catch (error) {
        if (order.settling) return order.settling;
        if (order.result) return order.result;
        if (error instanceof PaymentError && error.definite) {
          order.phase = "failed";
          order.result = {
            status: "failed",
            code: error.code,
            message: error.message,
          };
          return order.result;
        }
        // A timeout might follow an accepted charge. Never submit it a second time.
        order.phase = "pending";
        throw error;
      }
    })().finally(() => {
      order.initiating = null;
    });
    return order.initiating;
  }

  function validatePaymentDetails(order, collection) {
    if (
      collection.currency !== "ZMW" ||
      !["string", "number"].includes(typeof collection.amount) ||
      !Number.isFinite(Number(collection.amount)) ||
      Math.abs(Number(collection.amount) - order.total) > 0.000001 ||
      (collection.phone !== undefined && collection.phone !== order.phone)
    ) {
      throw new PaymentError(
        "PAYMENT_MISMATCH",
        "The payment details do not match this order. Please contact the shop with your payment reference.",
        409,
      );
    }
  }

  async function settle(order, collection) {
    if (order.settling) return order.settling;
    if (order.result) return order.result;
    if (!collection) return state(order);
    if (collection.reference !== order.reference) {
      throw new PaymentError(
        "PAYMENT_MISMATCH",
        "The payment reference does not match this checkout. Please contact the shop with your order reference.",
        409,
      );
    }
    if (/^\d{1,6}$/.test(String(collection.gatewayCode || "")))
      order.gatewayCode = String(collection.gatewayCode);
    if (typeof collection.confirmationAvailable === "boolean")
      order.confirmationAvailable = collection.confirmationAvailable;
    if (collection.status === "pending") return state(order);
    if (collection.status === "failed") {
      validatePaymentDetails(order, collection);
      order.phase = "failed";
      order.result = {
        status: "failed",
        message: "The payment was declined. Your basket is unchanged.",
      };
      return order.result;
    }
    if (collection.status !== "successful") return state(order);
    validatePaymentDetails(order, collection);
    order.phase = "successful";
    const receipt = {
      ...order,
      orderId: order.reference,
      paymentRef: collection.transactionId || order.gatewayTransactionId || collection.operatorReference || order.reference,
      paidAt: new Date(now()).toISOString(),
      paymentMethod: "Mobile money via ZynlePay",
    };
    order.settling = (async () => {
      let emailSent = false;
      try {
        await sendReceipt(receipt);
        emailSent = true;
      } catch (error) {
        onMailError(error);
      }
      order.result = {
        status: "successful",
        orderId: receipt.orderId,
        paymentRef: receipt.paymentRef,
        paidAt: receipt.paidAt,
        name: receipt.name,
        email: receipt.email,
        paymentMethod: receipt.paymentMethod,
        subtotal: receipt.subtotal,
        deliveryCharge: receipt.deliveryCharge,
        total: receipt.total,
        emailSent,
      };
      return order.result;
    })().finally(() => { order.settling = null; });
    return order.settling;
  }

  async function finalize(order) {
    let collection;
    try {
      collection = await getStatus(order);
    } catch (error) {
      if (order.settling) return order.settling;
      if (order.result) return order.result;
      throw error;
    }
    return settle(order, collection);
  }

  // The router authenticates the provider before calling this method.
  function receiveCallback(payload) {
    const collection = parseZynlePaymentCallback(payload);
    const order = find(collection.reference);
    if (order.phase === "created") {
      throw new PaymentError("PAYMENT_NOT_INITIATED", "This checkout has not been submitted for payment.", 409);
    }
    validatePaymentDetails(order, collection);
    const previous = order.callbackCollection;
    if ((previous && (previous.status !== collection.status || previous.operatorReference !== collection.operatorReference)) ||
        (order.result && order.result.status !== collection.status)) {
      throw new PaymentError("PAYMENT_CALLBACK_CONFLICT", "This callback conflicts with a recorded payment result.", 409);
    }
    order.callbackCollection = collection;
    // Settlement starts before acknowledgement. SMTP runs separately so provider
    // retries can be acknowledged promptly without sending another receipt.
    settle(order, collection).catch(error => {
      console.error('[payments] Callback settlement failed:', error.code || error.name);
    });
    return { response_code: "130", reference_no: order.reference };
  }

  async function verify(reference, token) {
    const order = authorized(reference, token);
    if (order.settling) return order.settling;
    if (order.result) return order.result;
    if (order.initiating) await order.initiating;
    if (order.result || order.phase === "created" || !getStatus)
      return state(order);
    // Queries are read-only and concurrent checks share one provider request.
    // Only independently verified canonical transaction data can confirm payment.
    if (!order.verifying)
      order.verifying = finalize(order).finally(() => {
        order.verifying = null;
      });
    return order.verifying;
  }

  return { create, initiate, verify, receiveCallback };
}
