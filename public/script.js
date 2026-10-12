const fallbackProducts = [
  [
    "Campus Classic A4 Notebook",
    "Stationery",
    65,
    "A4",
    "product-coral",
    "Bestseller",
    "A durable ruled notebook for lectures, tutorials and revision notes.",
  ],
  [
    "Exam Ready Writing Kit",
    "Stationery",
    89,
    "WR",
    "product-amber",
    "Campus Pick",
    "Pens, pencils, eraser and ruler packed for a focused study session.",
  ],
  [
    "ColourCode Study Set",
    "Stationery",
    115,
    "CC",
    "product-lilac",
    "New",
    "Highlighters and page markers that make key ideas easy to find.",
  ],
  [
    "Academic Writing Made Simple",
    "Study Materials",
    128,
    "AW",
    "product-green",
    "Recommended",
    "A practical guide for clearer essays, citations and reports.",
  ],
  [
    "STEM Revision Flashcards",
    "Study Materials",
    159,
    "ST",
    "product-blue",
    "Popular",
    "Quick-fire cards for formulas, definitions and last-minute recall.",
  ],
  [
    "Semester Success Planner",
    "Study Materials",
    98,
    "PL",
    "product-peach",
    "Student Favourite",
    "Weekly planning pages for deadlines, habits and study blocks.",
  ],
  [
    "VoltGo 10,000mAh Power Bank",
    "Electronics and Accessories",
    399,
    "VP",
    "product-slate",
    "Low Stock",
    "Reliable backup power for phones and tablets between classes.",
  ],
  [
    "StudyBeat Wireless Earbuds",
    "Electronics and Accessories",
    325,
    "SB",
    "product-lilac",
    "Great Value",
    "Compact wireless audio for focus playlists and recorded lectures.",
  ],
  [
    "FlexGlow Rechargeable Desk Lamp",
    "Electronics and Accessories",
    245,
    "FG",
    "product-green",
    "Hostel Pick",
    "A soft, rechargeable study light for desks and shared rooms.",
  ],
  [
    "QuickBoil 1.7L Electric Kettle",
    "Hostel Essentials",
    315,
    "QB",
    "product-amber",
    "Bestseller",
    "Fast hot water for tea, coffee and simple hostel meals.",
  ],
  [
    "SoftNest Single Bedding Set",
    "Hostel Essentials",
    449,
    "SN",
    "product-blue",
    "Limited Stock",
    "A comfortable single-size sheet, pillowcase and duvet cover set.",
  ],
  [
    "FoldFlat Laundry Basket",
    "Hostel Essentials",
    169,
    "FL",
    "product-coral",
    "Space Saver",
    "A lightweight foldable basket for compact student accommodation.",
  ],
  [
    "Mealielite Maize Meal 5kg",
    "Essential Groceries",
    125,
    "MM",
    "product-amber",
    "Pantry Basic",
    "A practical 5kg maize meal staple for simple student meals.",
  ],
  [
    "Golden Drop Cooking Oil 2L",
    "Essential Groceries",
    95,
    "CO",
    "product-amber",
    "Everyday Value",
    "Versatile cooking oil for quick hostel meals and meal prep.",
  ],
  [
    "Campus Rice 2kg",
    "Essential Groceries",
    78,
    "RC",
    "product-green",
    "Student Favourite",
    "Easy-to-store rice for affordable lunches and shared dinners.",
  ],
  [
    "SweetDay Sugar 2kg",
    "Essential Groceries",
    65,
    "SG",
    "product-blue",
    "Pantry Basic",
    "A kitchen staple for tea, porridge and everyday refreshments.",
  ],
  [
    "Student Pantry Starter Pack",
    "Essential Groceries",
    210,
    "SP",
    "product-coral",
    "Bundle Save",
    "A convenient mix of rice, beans, sugar and cooking basics.",
  ],
  [
    "Ballpoint Pens 10 Pack",
    "Stationery",
    35,
    "BP",
    "product-green",
    "Lecture Basic",
    "Ten blue and black pens for everyday notes and assignments.",
  ],
  [
    "HB Pencils 12 Pack",
    "Stationery",
    30,
    "HB",
    "product-green",
    "Exam Kit",
    "A dozen HB pencils for calculations, sketches and diagrams.",
  ],
  [
    "A4 Lever Arch File",
    "Stationery",
    85,
    "AF",
    "product-green",
    "Stay Organised",
    "Keep handouts and course notes together in a sturdy ring file.",
  ],
  [
    "Sticky Notes 4 Pack",
    "Stationery",
    45,
    "NT",
    "product-green",
    "Quick Reminders",
    "Adhesive note pads for reminders, page tabs and study prompts.",
  ],
  [
    "Geometry Instrument Set",
    "Stationery",
    68,
    "GS",
    "product-green",
    "Classroom Kit",
    "Compass, protractor and set squares for technical classwork.",
  ],
  [
    "Desk Stapler and Staples",
    "Stationery",
    75,
    "DS",
    "product-green",
    "Assignment Ready",
    "A compact stapler with staples for neatly finished printouts.",
  ],
  [
    "A4 Printing Paper 500 Sheets",
    "Stationery",
    110,
    "PP",
    "product-green",
    "Print Essential",
    "One ream of plain paper for assignments and revision sheets.",
  ],
  [
    "Zip Pencil Case",
    "Stationery",
    55,
    "PC",
    "product-green",
    "Bag Essential",
    "A zipped pouch to keep your everyday writing tools together.",
  ],
  [
    "Document Wallets 5 Pack",
    "Stationery",
    40,
    "DW",
    "product-green",
    "Stay Organised",
    "Lightweight wallets for protecting loose notes and forms.",
  ],
  [
    "Scientific Calculator",
    "Study Materials",
    225,
    "SC",
    "product-green",
    "STEM Essential",
    "A non-programmable calculator for maths and science practice.",
  ],
  [
    "Blank Revision Cards 100 Pack",
    "Study Materials",
    50,
    "BC",
    "product-green",
    "Active Recall",
    "Create your own question-and-answer cards for any subject.",
  ],
  [
    "A3 Reusable Study Whiteboard",
    "Study Materials",
    145,
    "WB",
    "product-green",
    "Revision Tool",
    "A small whiteboard with marker for working through problems.",
  ],
  [
    "Accounting Practice Workbook",
    "Study Materials",
    135,
    "AC",
    "product-green",
    "Business Studies",
    "Practice questions covering journals, ledgers and trial balances.",
  ],
  [
    "Intro to Programming Workbook",
    "Study Materials",
    155,
    "PR",
    "product-green",
    "Computing",
    "Exercises in logic, pseudocode and introductory programming.",
  ],
  [
    "Research and Referencing Guide",
    "Study Materials",
    120,
    "RG",
    "product-green",
    "Report Ready",
    "A study guide to planning research and organising references.",
  ],
  [
    "Adjustable Book Stand",
    "Study Materials",
    165,
    "BS",
    "product-green",
    "Desk Essential",
    "Keep textbooks upright while you type or take handwritten notes.",
  ],
  [
    "USB-C Charging Cable 2m",
    "Electronics and Accessories",
    65,
    "UC",
    "product-green",
    "Everyday Tech",
    "A two-metre USB-C cable for compatible phones and accessories.",
  ],
  [
    "Dual USB Wall Charger",
    "Electronics and Accessories",
    120,
    "DC",
    "product-green",
    "Charging Basic",
    "A two-port charger for compatible USB-powered devices.",
  ],
  [
    "USB Flash Drive 64GB",
    "Electronics and Accessories",
    125,
    "FD",
    "product-green",
    "Backup Essential",
    "Carry presentations, assignments and copies of your study files.",
  ],
  [
    "Wireless Optical Mouse",
    "Electronics and Accessories",
    145,
    "WM",
    "product-green",
    "Laptop Essential",
    "A wireless mouse with USB receiver for everyday laptop use.",
  ],
  [
    "Compact USB Keyboard",
    "Electronics and Accessories",
    195,
    "KB",
    "product-green",
    "Desk Setup",
    "A wired keyboard for typing essays and working on projects.",
  ],
  [
    "Adjustable Laptop Stand",
    "Electronics and Accessories",
    220,
    "LS",
    "product-green",
    "Desk Setup",
    "A folding stand to raise your laptop on a study desk.",
  ],
  [
    "Laptop Sleeve 15.6 Inch",
    "Electronics and Accessories",
    180,
    "SL",
    "product-green",
    "On the Go",
    "A padded sleeve for carrying a compatible laptop in your bag.",
  ],
  [
    "Over-Ear Wired Headphones",
    "Electronics and Accessories",
    185,
    "OH",
    "product-green",
    "Lecture Audio",
    "Wired headphones with a microphone for calls and recordings.",
  ],
  [
    "Four-Port USB Hub",
    "Electronics and Accessories",
    155,
    "UH",
    "product-green",
    "More Connections",
    "Connect a mouse, keyboard and other USB accessories.",
  ],
  [
    "HDMI Cable 1.5m",
    "Electronics and Accessories",
    85,
    "HD",
    "product-green",
    "Presentation Kit",
    "Connect compatible laptops to classroom screens or monitors.",
  ],
  [
    "Foldable Phone Stand",
    "Electronics and Accessories",
    55,
    "PS",
    "product-green",
    "Small Essential",
    "Keep your phone upright for video calls and reading notes.",
  ],
  [
    "Laptop Backpack",
    "Electronics and Accessories",
    295,
    "LB",
    "product-green",
    "Campus Carry",
    "A backpack with a laptop compartment and space for notebooks.",
  ],
  [
    "Cotton Bath Towel",
    "Hostel Essentials",
    115,
    "BT",
    "product-green",
    "Room Essential",
    "A full-size cotton towel for everyday hostel use.",
  ],
  [
    "Shower Caddy",
    "Hostel Essentials",
    95,
    "SH",
    "product-green",
    "Shared Bathroom",
    "Carry shampoo, soap and toiletries to shared washrooms.",
  ],
  [
    "Toiletry Starter Kit",
    "Hostel Essentials",
    135,
    "TK",
    "product-green",
    "Everyday Care",
    "A toothbrush, toothpaste and soap in a reusable wash bag.",
  ],
  [
    "Laundry Detergent 1kg",
    "Hostel Essentials",
    68,
    "LD",
    "product-green",
    "Laundry Day",
    "Washing powder for keeping everyday clothes clean.",
  ],
  [
    "Clothes Hangers 10 Pack",
    "Hostel Essentials",
    75,
    "CH",
    "product-green",
    "Room Organiser",
    "Matching hangers to organise shirts and jackets in a small space.",
  ],
  [
    "Reusable Water Bottle 750ml",
    "Hostel Essentials",
    85,
    "WT",
    "product-green",
    "Campus Carry",
    "A refillable bottle for lectures, study breaks and sports.",
  ],
  [
    "Lunch Box with Compartments",
    "Hostel Essentials",
    95,
    "LX",
    "product-green",
    "Meal Prep",
    "Pack lunch and snacks for a full day on campus.",
  ],
  [
    "Food Storage Containers 3 Pack",
    "Hostel Essentials",
    125,
    "FC",
    "product-green",
    "Kitchen Basic",
    "Three lidded containers for dry ingredients and prepared meals.",
  ],
  [
    "Plate, Bowl and Mug Set",
    "Hostel Essentials",
    140,
    "PM",
    "product-green",
    "Kitchen Basic",
    "A simple three-piece set for meals and hot drinks.",
  ],
  [
    "Stainless Steel Cutlery Set",
    "Hostel Essentials",
    65,
    "CT",
    "product-green",
    "Kitchen Basic",
    "A reusable spoon, fork and table knife for everyday meals.",
  ],
  [
    "Compact Room Bin",
    "Hostel Essentials",
    80,
    "RB",
    "product-green",
    "Room Essential",
    "A small lidded waste bin that fits beside a desk.",
  ],
  [
    "Mosquito Net Single Bed",
    "Hostel Essentials",
    175,
    "MN",
    "product-green",
    "Room Essential",
    "A single-bed mosquito net with hanging loops for setup.",
  ],
  [
    "Rolled Oats 1kg",
    "Essential Groceries",
    65,
    "OA",
    "product-green",
    "Breakfast Basic",
    "Easy-to-store oats for porridge and overnight breakfasts.",
  ],
  [
    "Peanut Butter 400g",
    "Essential Groceries",
    55,
    "PB",
    "product-green",
    "Pantry Basic",
    "A spread for toast, sandwiches and simple snack recipes.",
  ],
  [
    "Dried Beans 1kg",
    "Essential Groceries",
    58,
    "DB",
    "product-green",
    "Meal Prep",
    "Dried beans for batch cooking and shared student meals.",
  ],
  [
    "Spaghetti Pasta 500g",
    "Essential Groceries",
    25,
    "PA",
    "product-green",
    "Quick Meal",
    "A pantry staple for a simple pasta lunch or dinner.",
  ],
  [
    "Instant Noodles 5 Pack",
    "Essential Groceries",
    45,
    "IN",
    "product-green",
    "Quick Meal",
    "Five individually packed portions for a convenient hot meal.",
  ],
  [
    "UHT Milk 1L",
    "Essential Groceries",
    32,
    "MK",
    "product-green",
    "Breakfast Basic",
    "Long-life milk for cereal, tea and coffee; chill after opening.",
  ],
  [
    "Tea Bags 100 Pack",
    "Essential Groceries",
    45,
    "TE",
    "product-green",
    "Study Break",
    "A pantry-sized box for morning tea and shared tea breaks.",
  ],
  [
    "Instant Coffee 100g",
    "Essential Groceries",
    78,
    "CF",
    "product-green",
    "Study Break",
    "Instant coffee for a quick cup between lectures.",
  ],
  [
    "Iodised Salt 1kg",
    "Essential Groceries",
    18,
    "SA",
    "product-green",
    "Cooking Basic",
    "An everyday seasoning staple for the student kitchen.",
  ],
  [
    "Tinned Baked Beans 400g",
    "Essential Groceries",
    30,
    "BB",
    "product-green",
    "Quick Meal",
    "Ready-to-heat beans for toast, rice or a quick side dish.",
  ],
  [
    "Tinned Tomatoes 400g",
    "Essential Groceries",
    28,
    "TM",
    "product-green",
    "Cooking Basic",
    "A handy base for pasta sauces, stews and bean dishes.",
  ],
  [
    "Soya Pieces 500g",
    "Essential Groceries",
    42,
    "SY",
    "product-green",
    "Meal Prep",
    "Dried soya pieces for adding to stews, rice and sauces.",
  ],
  [
    "Breakfast Cereal 500g",
    "Essential Groceries",
    62,
    "CE",
    "product-green",
    "Breakfast Basic",
    "A convenient cereal option for busy mornings before class.",
  ],
  [
    "Roasted Groundnuts 250g",
    "Essential Groceries",
    30,
    "GN",
    "product-green",
    "Snack Break",
    "A resealable snack pack for your bag or study desk.",
  ],
  [
    "Plain Crackers 200g",
    "Essential Groceries",
    25,
    "CR",
    "product-green",
    "Snack Break",
    "Light crackers to pair with a spread or enjoy between classes.",
  ],
];

function cataloguePhoto(id) {
  if (Number(id) === 39) return "images/products/laptop-stand.webp";
  return "images/products/product-" + String(id).padStart(2, "0") + ".jpg";
}

function localPhotoPath(url) {
  return typeof url === "string" ? url.replace(/^\/images\//, "images/") : url;
}

fallbackProducts.forEach((product, index) => {
  product[7] = index + 1;
  product[8] = 25;
  product[9] = cataloguePhoto(index + 1);
});

// The local array keeps the layout preview usable when MySQL is not running.
// The Task 3 server replaces it with the catalogue returned by the API.
const SELLER_PRODUCT_STORE = "unibasket.sellerProducts.v1";
let catalogueProducts = fallbackProducts;
let products = fallbackProducts;
let cart = [];

function readSellerProducts() {
  try {
    const raw = localStorage.getItem(SELLER_PRODUCT_STORE);
    if (!raw) return [];
    const value = JSON.parse(raw);
    return Array.isArray(value)
      ? value.filter(
          (product) =>
            product &&
            typeof product.id === "string" &&
            typeof product.name === "string",
        )
      : [];
  } catch {
    return [];
  }
}

function writeSellerProducts(list) {
  try {
    localStorage.setItem(SELLER_PRODUCT_STORE, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

function sellerRows(baseProducts) {
  return readSellerProducts()
    .map((product) => [
      product.name,
      product.category,
      Number(product.price),
      product.shortCode,
      product.artClass || "product-green",
      product.badge || "Seller listing",
      product.description,
      product.id,
      Number(product.stockQuantity),
      product.imageUrl || cataloguePhoto(1),
    ])
    .concat(baseProducts);
}

function mergeSellerProducts() {
  const nextProducts = sellerRows(catalogueProducts);
  cart = remapCart(cart, products, nextProducts);
  products = nextProducts;
  document.getElementById("count").textContent = cart.reduce((sum, item) => sum + item.q, 0);
  document.getElementById("productCount").textContent = products.length;
  render();
}

function remapCart(lines, previousProducts, nextProducts) {
  return lines.flatMap((line) => {
    const id = previousProducts[line.i]?.[7];
    const i = nextProducts.findIndex((product) => product[7] === id);
    if (i < 0) return [];
    const q = Math.min(line.q, nextProducts[i][8], 99);
    return q > 0 ? [{ i, q }] : [];
  });
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character],
  );
}

mergeSellerProducts();

function render() {
  const q = document.getElementById("search").value.trim().toLowerCase();
  const c = document.getElementById("category").value;
  const s = document.getElementById("sort").value;
  let list = products.filter(
    (p) =>
      (c === "All products" || p[1] === c) &&
      (!q || [p[0], p[1], p[6]].join(" ").toLowerCase().includes(q)),
  );
  list.sort((a, b) =>
    s === "low"
      ? a[2] - b[2]
      : s === "high"
        ? b[2] - a[2]
        : a[0].localeCompare(b[0]),
  );
  document.getElementById("shown").textContent =
    list.length + " of " + products.length + " products";
  document.getElementById("grid").innerHTML =
    list
      .map((p) => {
        const title = p[0];
        return (
          '<article class="product-card"><div class="product-art"><img src="' +
          escapeHtml(p[9] || cataloguePhoto(p[7])) +
          '" alt="Photo representing ' +
          escapeHtml(title) +
          '" loading="lazy" decoding="async"><small>' +
          escapeHtml(p[5]) +
          '</small></div><div class="product-info"><small>' +
          escapeHtml(p[1]) +
          "</small><h3>" +
          escapeHtml(title) +
          "</h3><p>" +
          escapeHtml(p[6]) +
          "</p><div><strong>ZMW " +
          Number(p[2]).toLocaleString() +
          '</strong><button type="button" aria-label="Add ' +
          escapeHtml(title) +
          ' to basket"' + (p[8] === 0 ? ' disabled' : '') + ' onclick="add(' +
          products.indexOf(p) +
          ')">Add</button></div><em>' +
          (p[8] === 0 ? "Out of stock" : "In stock") +
          "</em></div></article>"
        );
      })
      .join("") ||
    '<p class="empty-results">No products match. Try another search or choose All products.</p>';
}

function updateCategoryOptions(categories) {
  for (const id of ["category", "headerCategory"]) {
    const select = document.getElementById(id);
    select.replaceChildren(new Option("All products", "All products"));
    categories.forEach((category) =>
      select.add(new Option(category.name, category.name)),
    );
  }
}

async function loadCatalogue() {
  try {
    const [categoryResponse, productResponse] = await Promise.all([
      fetch("/api/categories"),
      fetch("/api/products?limit=100"),
    ]);
    if (!categoryResponse.ok || !productResponse.ok)
      throw new Error("Catalogue API unavailable");
    const categoriesPayload = await categoryResponse.json();
    const productsPayload = await productResponse.json();
    if (
      !Array.isArray(categoriesPayload.data) ||
      !Array.isArray(productsPayload.data)
    )
      throw new Error("Catalogue response invalid");
    updateCategoryOptions(categoriesPayload.data);
    catalogueProducts = productsPayload.data.map((product) => [
      product.name,
      product.category.name,
      Number(product.price),
      product.shortCode,
      product.artClass,
      product.badge,
      product.description,
      product.id,
      product.stockQuantity,
      localPhotoPath(product.imageUrl) || cataloguePhoto(product.id),
    ]);
    mergeSellerProducts();
  } catch (error) {
    console.info("Using the local catalogue preview:", error.message);
    mergeSellerProducts();
  }
}

function add(i) {
  const p = products[i];
  if (!p) return;
  const line = cart.find((item) => item.i === i);
  if ((line?.q || 0) >= Math.min(p[8], 99)) {
    showToast("The available quantity is already in your basket.");
    return;
  }
  if (line) line.q++;
  else cart.push({ i, q: 1 });
  document.getElementById("count").textContent = cart.reduce(
    (n, item) => n + item.q,
    0,
  );
  showToast(p[0] + " added to your basket.");
}

function openBasket() {
  document.getElementById("basketModal").hidden = false;
  document.body.classList.add("shopping-open");
  renderBasket();
}

function closeBasket() {
  const routePage = new URLSearchParams(window.location.search).get("page");
  document.getElementById("basketModal").hidden = true;
  document.body.classList.remove("shopping-open");
  if (routePage === "basket") {
    history.replaceState({}, "", "./");
    applyRoute();
  }
}

function basketSubtotal() {
  return cart.reduce((n, item) => n + products[item.i][2] * item.q, 0);
}

function deliveryCharge() {
  const method = document.getElementById("deliveryMethod").value;
  return method === "pickup" ? 0 : method === "courier" ? 30 : 15;
}

function openCheckout() {
  if (!cart.length) {
    closeBasket();
    showToast("Add at least one product before checkout.");
    return;
  }
  if (!currentUser) {
    pendingCheckout = true;
    navigateTo("account");
    accountError("Create an account or sign in before proceeding to payment.");
    return;
  }
  closeBasket();
  document.getElementById("checkoutModal").hidden = false;
  document.body.classList.add("shopping-open");
  document.getElementById("checkoutForm").hidden = false;
  document.getElementById("checkoutSuccess").hidden = true;
  document.getElementById("checkoutError").hidden = true;
  const nameInput = document.getElementById("checkoutName");
  nameInput.value = currentUser?.name || "";
  nameInput.readOnly = Boolean(currentUser);
  updateCheckoutTotal();
}

function closeCheckout() {
  document.getElementById("checkoutModal").hidden = true;
  document.body.classList.remove("shopping-open");
}

function returnToCatalogue() {
  closeCheckout();
  navigateTo("home");
}

function updateCheckoutTotal() {
  document.getElementById("checkoutItems").textContent =
    cart.reduce((n, item) => n + item.q, 0) + " items";
  document.getElementById("checkoutTotal").textContent =
    "ZMW " + (basketSubtotal() + deliveryCharge()).toLocaleString();
}

async function submitCheckout() {
  if (document.getElementById("checkoutSubmit")?.disabled) return;
  const error = document.getElementById("checkoutError");
  if (!currentUser) {
    closeCheckout();
    pendingCheckout = true;
    navigateTo("account");
    accountError("Create an account or sign in before proceeding to payment.");
    return;
  }
  const buyerName = (
    currentUser?.name || document.getElementById("checkoutName").value
  ).trim();
  if (buyerName.length < 2) {
    error.textContent = "Enter your full name before placing the order.";
    error.hidden = false;
    document.getElementById("checkoutName").focus();
    return;
  }
  const submit = document.getElementById("checkoutSubmit");
  error.hidden = true;
  submit.disabled = true;
  submit.textContent = "Processing test payment…";
  let response,
    payload = {};
  try {
    response = await fetch("/api/demo-payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: currentUser.email,
        name: buyerName,
        phone: document.getElementById("checkoutPhone").value,
        paymentMethod: document.getElementById("paymentMethod").value,
        deliveryMethod: document.getElementById("deliveryMethod").value,
        deliveryNote: document.getElementById("deliveryNote").value,
        outcome: document.querySelector('input[name="paymentOutcome"]:checked')
          .value,
        items: cart.map((item) => ({
          name: products[item.i][0],
          price: products[item.i][2],
          quantity: item.q,
        })),
      }),
    });
    payload = await response.json().catch(() => ({}));
  } catch {
    response = null;
  } finally {
    submit.disabled = false;
    submit.textContent = "Submit test payment";
  }
  if (!response || !response.ok) {
    error.textContent =
      payload.error?.message ||
      (response
        ? "The payment could not be processed. Open the site through the UniBasket server (npm start)."
        : "The payment could not be processed because the UniBasket server is not reachable. Start it with npm start.");
    error.hidden = false;
    return;
  }
  const order = payload.data;
  document.getElementById("confirmationName").textContent =
    "Thank you, " + buyerName + ".";
  document.getElementById("orderId").textContent = order.orderId;
  document.getElementById("paymentRef").textContent = order.paymentRef;
  document.getElementById("paymentMethodPaid").textContent =
    order.paymentMethod;
  document.getElementById("orderTotal").textContent =
    "ZMW " + order.total.toLocaleString();
  document.getElementById("receiptStatus").textContent = order.emailSent
    ? "A receipt has been emailed to " + currentUser.email + "."
    : "Your order is confirmed, but the receipt email could not be sent.";
  document.getElementById("checkoutForm").hidden = true;
  document.getElementById("checkoutSuccess").hidden = false;
  cart = [];
  document.getElementById("count").textContent = "0";
  renderBasket();
}

function renderBasket() {
  const total = cart.reduce((n, item) => n + products[item.i][2] * item.q, 0);
  document.getElementById("subtotal").textContent =
    "ZMW " + total.toLocaleString();
  document.getElementById("basketLines").innerHTML = cart.length
    ? '<div class="panel-lines">' +
      cart
        .map((item) => {
          const p = products[item.i];
          return (
            '<div class="panel-line"><img class="basket-product-photo" src="' +
            escapeHtml(p[9] || cataloguePhoto(p[7])) +
            '" alt="" loading="lazy"><div><strong>' +
            escapeHtml(p[0]) +
            "</strong><small>ZMW " +
            p[2] +
            ' each</small><div class="quantity"><button type="button" onclick="changeQty(' +
            item.i +
            ',-1)">−</button><span>' +
            item.q +
            '</span><button type="button" onclick="changeQty(' +
            item.i +
            ',1)">+</button></div></div><b>ZMW ' +
            (p[2] * item.q).toLocaleString() +
            "</b></div>"
          );
        })
        .join("") +
      "</div>"
    : '<div class="empty-panel"><span class="empty-icon">UB</span><h3>Your basket is ready for its first item.</h3><p>Add a product below to start your order.</p></div>';
}

function changeQty(i, d) {
  const line = cart.find((item) => item.i === i);
  if (!line) return;
  if (d > 0 && line.q >= Math.min(products[i][8], 99)) {
    showToast("The available quantity is already in your basket.");
    return;
  }
  line.q += d;
  if (line.q < 1) cart = cart.filter((item) => item.i !== i);
  document.getElementById("count").textContent = cart.reduce(
    (n, item) => n + item.q,
    0,
  );
  renderBasket();
}

function filterCategory(c) {
  navigateTo("products");
  document.getElementById("category").value = c;
  document.getElementById("headerCategory").value = c;
  document.getElementById("search").value = "";
  document.getElementById("headerSearch").value = "";
  document.getElementById("products").scrollIntoView({ behavior: "smooth" });
  render();
}

function showToast(t) {
  const el = document.getElementById("toast");
  el.textContent = t;
  el.hidden = false;
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => (el.hidden = true), 2200);
}

// Local assignment accounts: no server authentication or shared account database.
// Store salted PBKDF2 verifiers, never plain-text passwords.
const ACCOUNT_STORE = "unibasket.accounts.v1";
const SESSION_STORE = "unibasket.session.v1";
const PASSWORD_ITERATIONS = 600000;
let currentUser = null;
let accountBusy = false;
let accountReturnFocus = null;
let pendingCheckout = false;
let resetChallenge = null;

function readAccounts() {
  let raw;
  try {
    raw = localStorage.getItem(ACCOUNT_STORE);
  } catch {
    throw new Error(
      "Browser storage is unavailable. Allow site storage to create or use an account.",
    );
  }
  if (raw === null) return [];
  try {
    const data = JSON.parse(raw);
    if (data.version !== 1 || !Array.isArray(data.users)) throw new Error();
    const valid = data.users.every(
      (user) =>
        user &&
        typeof user.name === "string" &&
        typeof user.email === "string" &&
        /^[a-f0-9]{32}$/.test(user.salt) &&
        /^[a-f0-9]{64}$/.test(user.verifier),
    );
    if (!valid) throw new Error();
    return data.users.map((user) => ({
      ...user,
      role: user.role === "seller" ? "seller" : "buyer",
    }));
  } catch {
    throw new Error(
      "The saved account data could not be read. Try another browser; the existing data has not been changed.",
    );
  }
}

function writeAccounts(users) {
  try {
    localStorage.setItem(ACCOUNT_STORE, JSON.stringify({ version: 1, users }));
  } catch {
    throw new Error(
      "Your account could not be saved. Allow browser storage or free some space, then try again.",
    );
  }
}

function validateAccountTransfer(payload) {
  if (!payload || payload.version !== 1 || !Array.isArray(payload.users) ||
      !payload.users.length || payload.users.length > 100 || !Array.isArray(payload.listings) || payload.listings.length > 1000) {
    throw new Error("The saved accounts could not be transferred.");
  }
  const users = payload.users.map((user) => {
    if (!user || typeof user.name !== "string" || user.name.length > 80 ||
        typeof user.email !== "string" || user.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email) ||
        !/^[a-f0-9]{32}$/.test(user.salt) || !/^[a-f0-9]{64}$/.test(user.verifier)) {
      throw new Error("One of the saved accounts is invalid. The original accounts have not been changed.");
    }
    return { name: user.name, email: normaliseEmail(user.email), salt: user.salt, verifier: user.verifier, role: user.role === "seller" ? "seller" : "buyer" };
  });
  const categories = [...new Set(fallbackProducts.map(product => product[1]))];
  const listings = payload.listings.map((listing) => {
    if (!listing || typeof listing.id !== "string" || !/^seller-[a-z0-9-]+$/.test(listing.id) ||
        typeof listing.name !== "string" || !listing.name.trim() || listing.name.length > 120 ||
        !categories.includes(listing.category) || !Number.isFinite(listing.price) || listing.price < 0 ||
        !Number.isInteger(listing.stockQuantity) || listing.stockQuantity < 0 ||
        typeof listing.description !== "string" || listing.description.length > 2000 ||
        !users.some(user => user.email === listing.sellerEmail && user.role === "seller") ||
        typeof listing.imageUrl !== "string" || listing.imageUrl.length > 2000000 ||
        !/^(?:data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/=]+|\/?images\/products\/[a-zA-Z0-9.-]+)$/.test(listing.imageUrl)) {
      throw new Error("A seller listing could not be transferred. The original accounts have not been changed.");
    }
    return { id: listing.id, name: listing.name, category: listing.category, price: listing.price,
      stockQuantity: listing.stockQuantity, description: listing.description, sellerEmail: listing.sellerEmail,
      imageUrl: listing.imageUrl, shortCode: listing.name.slice(0, 3).toUpperCase(), artClass: "product-green", badge: "Seller listing" };
  });
  return { users, listings };
}

function saveTransferredAccounts(payload) {
  const { users, listings } = validateAccountTransfer(payload);
  const existing = readAccounts();
  const added = users.filter(user => !existing.some(account => account.email === user.email));
  const eligibleEmails = users.filter(user => added.includes(user) || existing.some(account =>
    account.email === user.email && account.salt === user.salt && account.verifier === user.verifier)).map(user => user.email);
  const currentListings = readSellerProducts();
  const newListings = listings.filter(listing => eligibleEmails.includes(listing.sellerEmail) &&
    !currentListings.some(saved => saved.id === listing.id));
  const previousAccounts = localStorage.getItem(ACCOUNT_STORE);
  const previousListings = localStorage.getItem(SELLER_PRODUCT_STORE);
  try {
    if (!writeSellerProducts([...currentListings, ...newListings])) throw new Error("The seller listings could not be saved.");
    writeAccounts([...existing, ...added]);
  } catch (error) {
    // Restore the destination if either write fails; the source is never deleted.
    for (const [key, value] of [[ACCOUNT_STORE, previousAccounts], [SELLER_PRODUCT_STORE, previousListings]]) {
      try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      } catch { /* Original file-preview data remains available for another attempt. */ }
    }
    throw error;
  }
  return { added: added.length, email: users[0].email, skipped: users.length - added.length };
}

function moveFilePreviewAccounts() {
  if (window.location.protocol !== "file:") return;
  clearAccountFeedback();
  let users;
  try {
    users = readAccounts();
    if (!users.length) throw new Error("No saved accounts were found in this file preview. Open the file address where you originally registered.");
  } catch (error) {
    accountError(error.message);
    return;
  }
  const origin = "http://127.0.0.1:4176";
  const token = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  const payload = { version: 1, users, listings: readSellerProducts() };
  let destination;
  const listener = (event) => {
    if (event.origin !== origin || event.source !== destination || event.data?.token !== token) return;
    if (event.data.type === "unibasket-transfer-ready") {
      destination.postMessage({ type: "unibasket-account-transfer", token, payload }, origin);
    } else if (event.data.type === "unibasket-transfer-result") {
      cleanup();
      if (event.data.ok) document.getElementById("accountStatus").textContent = "Your accounts are available in the UniBasket tab. Your original saved accounts are unchanged.";
      else accountError(event.data.message || "The transfer failed. Your original accounts are unchanged.");
    }
  };
  const cleanup = () => {
    window.removeEventListener("message", listener);
    clearTimeout(timer);
  };
  window.addEventListener("message", listener);
  const timer = setTimeout(() => {
    cleanup();
    accountError("The running app did not respond. Start it with npm start, allow the new tab, and try again. Your saved accounts are unchanged.");
  }, 60000);
  destination = window.open(origin + "/?page=account&transfer=" + token, "_blank");
  if (!destination) {
    cleanup();
    accountError("Allow this page to open a new tab, then click Move saved accounts again.");
  }
}

function receiveFilePreviewAccounts() {
  const token = new URLSearchParams(window.location.search).get("transfer");
  if (window.location.origin !== "http://127.0.0.1:4176" || !window.opener || !/^[a-f0-9]{32}$/.test(token || "")) return;
  const source = window.opener;
  const listener = (event) => {
    if (event.source !== source || event.origin !== "null" || event.data?.type !== "unibasket-account-transfer" || event.data.token !== token) return;
    window.removeEventListener("message", listener);
    let result;
    try {
      result = saveTransferredAccounts(event.data.payload);
      mergeSellerProducts();
      setAccountMode("reset");
      document.getElementById("resetEmail").value = result.email;
      document.getElementById("accountStatus").textContent = result.added + " account(s) copied from your file preview. Existing accounts were kept. You can now sign in or reset your password.";
      source.postMessage({ type: "unibasket-transfer-result", token, ok: true }, "*");
    } catch (error) {
      accountError(error.message);
      source.postMessage({ type: "unibasket-transfer-result", token, ok: false, message: error.message }, "*");
    }
    history.replaceState({}, "", "?page=account");
  };
  window.addEventListener("message", listener);
  // This handshake contains no account data. Account data is sent only to the exact server origin.
  source.postMessage({ type: "unibasket-transfer-ready", token }, "*");
}

async function sendAccountConfirmation(email, name) {
  let response;
  try {
    response = await fetch("/api/account-confirmations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name }),
    });
  } catch {
    throw new Error(
      "The confirmation email could not be sent because the UniBasket server is not reachable. Start it with npm start.",
    );
  }
  if (!response.ok) {
    let message =
      response.status === 404 ||
      response.status === 405 ||
      response.status === 501
        ? "The confirmation email could not be sent. Open the site through the UniBasket server (npm start), not a static preview."
        : "The confirmation email could not be sent.";
    try {
      const payload = await response.json();
      message = payload.error?.message || message;
    } catch {
      // Keep the useful fallback message when the server response is not JSON.
    }
    throw new Error(message);
  }
}

function normaliseEmail(value) {
  return value.trim().toLowerCase();
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

async function passwordVerifier(password, salt) {
  if (!globalThis.crypto?.subtle) {
    throw new Error(
      "Password checks need a supported browser. Open this project using localhost or HTTPS.",
    );
  }
  const saltBytes = Uint8Array.from(salt.match(/.{2}/g), (pair) =>
    parseInt(pair, 16),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: PASSWORD_ITERATIONS,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return bytesToHex(new Uint8Array(bits));
}

function accountError(message) {
  const error = document.getElementById("accountError");
  error.textContent = message;
  error.hidden = false;
}

function clearAccountFeedback() {
  document.getElementById("accountError").hidden = true;
  document.getElementById("accountError").textContent = "";
  document.getElementById("accountStatus").textContent = "";
  const profileStatus = document.getElementById("profileSaveStatus");
  profileStatus.textContent = "";
  profileStatus.hidden = true;
}

function setAccountBusy(busy, message = "") {
  accountBusy = busy;
  const modal = document.getElementById("accountModal");
  modal
    .querySelectorAll("button,input,select,textarea")
    .forEach((control) => (control.disabled = busy));
  modal.querySelector(".account-panel").setAttribute("aria-busy", String(busy));
  document.getElementById("accountStatus").textContent = message;
}

function updateAccountButton() {
  document.getElementById("accountButton").textContent = currentUser
    ? "Account"
    : "Sign in";
}

function showAccountProfile() {
  resetChallenge = null;
  document.getElementById("passwordResetArea").hidden = true;
  document.getElementById("accountTitle").textContent = "Your account";
  document.getElementById("accountTabs").hidden = true;
  document.getElementById("accountForm").hidden = true;
  document.getElementById("registerForm").hidden = true;
  document.getElementById("accountSuccess").hidden = false;
  document.getElementById("accountWelcome").textContent =
    currentUser.role === "seller" ? "Seller profile" : "Buyer profile";
  document.getElementById("profileName").textContent = currentUser.name;
  document.getElementById("profileNameInput").value = currentUser.name;
  document.getElementById("profileEmail").textContent = currentUser.email;
  selectAccountRole(currentUser.role || "buyer");
  updateAccountButton();
  document.getElementById("accountWelcome").focus();
}

function selectAccountRole(role) {
  if (!currentUser || role !== (currentUser.role || "buyer")) return;
  const seller = role === "seller";
  document.querySelectorAll(".profile-role").forEach((button) => {
    const active = button.dataset.role === role;
    button.hidden = !active;
    button.classList.toggle("profile-role-active", active);
  });
  document.getElementById("profileRole").textContent = seller
    ? "Seller account"
    : "Buyer account";
  document.getElementById("sellerDashboard").hidden = !seller;
  if (seller) renderSellerListings();
  document.getElementById("accountStatus").textContent = seller
    ? "Seller tools are ready. Add a product and publish it to the catalogue."
    : "Buyer shopping tools are ready to use.";
}

function saveProfileName() {
  if (!currentUser || accountBusy) return;
  clearAccountFeedback();
  const input = document.getElementById("profileNameInput");
  const name = input.value.trim();
  if (!input.reportValidity() || name.length < 2) {
    accountError("Enter a name with at least two characters.");
    return;
  }
  try {
    const users = readAccounts();
    const account = users.find((user) => user.email === currentUser.email);
    if (!account)
      throw new Error("Your account could not be found. Please sign in again.");
    account.name = name;
    writeAccounts(users);
    currentUser.name = name;
    input.value = name;
    document.getElementById("profileName").textContent = name;
    document.getElementById("accountStatus").textContent =
      "Your profile name was saved.";
    const profileStatus = document.getElementById("profileSaveStatus");
    profileStatus.textContent = "Your profile name was saved.";
    profileStatus.hidden = false;
  } catch (error) {
    accountError(error.message || "Your name could not be saved.");
  }
}

function renderSellerListings() {
  const container = document.getElementById("sellerListings");
  if (!container || !currentUser) return;
  const listings = readSellerProducts().filter(
    (product) => product.sellerEmail === currentUser.email,
  );
  container.innerHTML = listings.length
    ? "<h5>Your listings</h5>" +
      listings
        .map(
          (product) =>
            '<div class="seller-listing"><div><strong>' +
            escapeHtml(product.name) +
            "</strong><small>ZMW " +
            Number(product.price).toLocaleString() +
            " · " +
            product.stockQuantity +
            ' in stock</small></div><button type="button" class="listing-remove" onclick="removeSellerProduct(\'' +
            escapeHtml(product.id) +
            "')\">Remove</button></div>",
        )
        .join("")
    : '<p class="fine-print">You have not published any products yet.</p>';
}

function prepareSellerPhoto(file) {
  return new Promise((resolve, reject) => {
    if (
      !file ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      reject(new Error("Choose a JPEG, PNG or WebP product photo."));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error("The product photo must be smaller than 8 MB."));
      return;
    }
    const url = URL.createObjectURL(file);
    const photo = new Image();
    photo.onload = () => {
      try {
        const scale = Math.min(
          1,
          800 / Math.max(photo.naturalWidth, photo.naturalHeight),
        );
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(photo.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(photo.naturalHeight * scale));
        canvas
          .getContext("2d")
          .drawImage(photo, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/webp", 0.76));
      } catch {
        reject(
          new Error("The photo could not be prepared. Choose another image."),
        );
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    photo.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The photo could not be opened. Choose another image."));
    };
    photo.src = url;
  });
}

async function submitSellerProduct() {
  if (!currentUser || currentUser.role !== "seller") return;
  const form = document.getElementById("sellerProductForm");
  if (!form.reportValidity()) return;
  const name = document.getElementById("sellerProductName").value.trim();
  const category = document.getElementById("sellerProductCategory").value;
  const price = Number(document.getElementById("sellerProductPrice").value);
  const stockQuantity = Number(
    document.getElementById("sellerProductStock").value,
  );
  const description = document
    .getElementById("sellerProductDescription")
    .value.trim();
  let imageUrl;
  try {
    imageUrl = await prepareSellerPhoto(
      document.getElementById("sellerProductPhoto").files[0],
    );
  } catch (error) {
    accountError(error.message);
    return;
  }
  const id =
    "seller-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 7);
  const product = {
    id,
    name,
    category,
    price,
    stockQuantity,
    description,
    imageUrl,
    shortCode: name
      .split(/\s+/)
      .map((word) => word[0])
      .join("")
      .slice(0, 3)
      .toUpperCase(),
    artClass: "product-green",
    badge: "Seller listing",
    sellerEmail: currentUser.email,
  };
  const listings = readSellerProducts();
  if (!writeSellerProducts([...listings, product])) {
    accountError(
      "The product could not be saved. Allow browser storage and try again.",
    );
    return;
  }
  mergeSellerProducts();
  form.reset();
  renderSellerListings();
  document.getElementById("accountStatus").textContent =
    product.name + " is now visible in the catalogue.";
}

function removeSellerProduct(id) {
  const listings = readSellerProducts().filter(
    (product) =>
      product.id !== id || product.sellerEmail !== currentUser?.email,
  );
  if (!writeSellerProducts(listings)) {
    accountError(
      "The product could not be removed. Allow browser storage and try again.",
    );
    return;
  }
  mergeSellerProducts();
  renderSellerListings();
  document.getElementById("accountStatus").textContent =
    "The product was removed from the catalogue.";
}

function startAccountSession(user) {
  currentUser = {
    name: user.name,
    email: user.email,
    role: user.role === "seller" ? "seller" : "buyer",
  };
  try {
    sessionStorage.setItem(SESSION_STORE, currentUser.email);
  } catch {
    // Registration is saved; the current page can still use an in-memory session.
  }
  document.getElementById("accountForm").reset();
  document.getElementById("registerForm").reset();
  showAccountProfile();
  if (pendingCheckout) {
    pendingCheckout = false;
    closeAccount();
    openCheckout();
  }
}

function setAccountMode(mode) {
  if (accountBusy) return;
  const register = mode === "register";
  const reset = mode === "reset";
  resetChallenge = null;
  document.getElementById("resetRequestForm").reset();
  document.getElementById("resetPasswordForm").reset();
  document.getElementById("passwordResetArea").hidden = !reset;
  document.getElementById("resetRequestForm").hidden = false;
  document.getElementById("resetPasswordForm").hidden = true;
  clearAccountFeedback();
  document
    .querySelectorAll('#accountModal input[type="password"]')
    .forEach((input) => (input.value = ""));
  document.getElementById("accountTitle").textContent = register
    ? "Create account"
    : reset ? "Reset password" : "Sign in";
  document.getElementById("accountTabs").hidden = false;
  document.getElementById("accountForm").hidden = register || reset;
  document.getElementById("registerForm").hidden = !register;
  document.getElementById("accountSuccess").hidden = true;
  document
    .getElementById("signInTab")
    .setAttribute("aria-pressed", String(!register && !reset));
  document
    .getElementById("registerTab")
    .setAttribute("aria-pressed", String(register));
  document.getElementById(register ? "registerName" : reset ? "resetEmail" : "accountEmail").focus();
}

async function resetApi(path, body) {
  if (window.location.protocol === "file:") {
    throw new Error("Password reset requires the running UniBasket app. Open http://127.0.0.1:4176/?page=account using the link above. Accounts saved in this file preview are separate from accounts in the running app.");
  }
  let response;
  try {
    response = await fetch("/api/password-resets" + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("The UniBasket server could not be reached. Start it with npm start, then open http://127.0.0.1:4176/?page=account and try again.");
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error?.message || "Password reset failed. Please try again.");
    error.code = payload.error?.code;
    throw error;
  }
  return payload;
}

async function requestPasswordReset() {
  if (accountBusy) return;
  clearAccountFeedback();
  const email = normaliseEmail(document.getElementById("resetEmail").value);
  document.getElementById("resetEmail").value = email;
  if (!document.getElementById("resetRequestForm").reportValidity()) return;
  setAccountBusy(true, "Sending your reset code…");
  let sent = false;
  try {
    if (!readAccounts().some((account) => account.email === email)) {
      throw new Error("No account with this email is saved here. If you registered in the file preview, reopen that file, refresh it, and click Move saved accounts. Then reset your password in the new UniBasket tab.");
    }
    const payload = await resetApi("", { email });
    if (!payload.data?.challengeId) throw new Error("The reset service returned an invalid response. Please try again.");
    resetChallenge = { ...payload.data, email };
    document.getElementById("resetPasswordForm").reset();
    document.getElementById("resetRequestForm").hidden = true;
    document.getElementById("resetPasswordForm").hidden = false;
    sent = true;
  } catch (error) {
    accountError(error.message);
  } finally {
    setAccountBusy(false, sent ? "A reset code has been emailed to " + email + ". It expires in 10 minutes." : "");
  }
  if (sent) document.getElementById("resetCode").focus();
}

async function submitPasswordReset() {
  if (accountBusy || !resetChallenge) return;
  clearAccountFeedback();
  const form = document.getElementById("resetPasswordForm");
  if (!form.reportValidity()) return;
  const password = document.getElementById("resetPassword").value;
  const confirm = document.getElementById("resetConfirm").value;
  if (password.trim().length < 8) {
    accountError("Use a password with at least 8 characters, excluding surrounding spaces.");
    return;
  }
  if (password !== confirm) {
    accountError("The passwords do not match.");
    return;
  }
  const email = resetChallenge.email;
  let saved = false;
  let verified = false;
  setAccountBusy(true, "Resetting your password…");
  try {
    // Derive locally before consuming the code. The password never leaves this browser.
    const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
    const verifier = await passwordVerifier(password, salt);
    const result = await resetApi("/verify", { email, challengeId: resetChallenge.challengeId, code: document.getElementById("resetCode").value.trim() });
    if (result.status !== "verified") throw new Error("The reset service returned an invalid response. Please try again.");
    verified = true;
    const users = readAccounts();
    const account = users.find((user) => user.email === email);
    if (!account) throw new Error("Your account could not be found in this browser.");
    account.salt = salt;
    account.verifier = verifier;
    writeAccounts(users);
    saved = true;
  } catch (error) {
    accountError((error.message || "Your password could not be reset.") + (verified ? " Request a new code before trying again." : ""));
  } finally {
    setAccountBusy(false);
  }
  if (saved) {
    setAccountMode("login");
    document.getElementById("accountEmail").value = email;
    document.getElementById("accountStatus").textContent = "Your password was reset. Sign in with your new password.";
    document.getElementById("accountPassword").focus();
  }
}

function openAccount() {
  accountReturnFocus = document.activeElement;
  closeBasket();
  closeCheckout();
  document.getElementById("accountModal").hidden = false;
  document.body.classList.add("account-open");
  document
    .querySelectorAll("body > header,body > main,body > footer")
    .forEach((el) => (el.inert = true));
  clearAccountFeedback();
  if (currentUser) showAccountProfile();
  else setAccountMode("login");
}

function closeAccount() {
  if (accountBusy) return;
  resetChallenge = null;
  const routePage = new URLSearchParams(window.location.search).get("page");
  document.getElementById("accountModal").hidden = true;
  document.body.classList.remove("account-open");
  document
    .querySelectorAll("body > header,body > main,body > footer")
    .forEach((el) => (el.inert = false));
  document
    .querySelectorAll('#accountModal input[type="password"]')
    .forEach((input) => (input.value = ""));
  if (accountReturnFocus?.isConnected) accountReturnFocus.focus();
  if (routePage === "account" || routePage === "seller") {
    history.replaceState({}, "", "./");
    applyRoute();
  }
}

async function submitRegistration() {
  if (accountBusy) return;
  clearAccountFeedback();
  const form = document.getElementById("registerForm");
  const name = document.getElementById("registerName").value.trim();
  const email = normaliseEmail(document.getElementById("registerEmail").value);
  const password = document.getElementById("registerPassword").value;
  const confirm = document.getElementById("registerConfirm").value;
  const role =
    document.getElementById("registerRole").value === "seller"
      ? "seller"
      : "buyer";
  document.getElementById("registerEmail").value = email;
  if (!form.reportValidity()) return;
  if (name.length < 2) {
    accountError("Enter your full name.");
    return;
  }
  if (password.trim().length < 8) {
    accountError(
      "Use a password with at least 8 characters, excluding surrounding spaces.",
    );
    return;
  }
  if (password !== confirm) {
    accountError("The passwords do not match.");
    return;
  }
  setAccountBusy(true, "Creating your account…");
  try {
    if (readAccounts().some((user) => user.email === email)) {
      throw new Error(
        "An account with this email already exists. Choose Sign in.",
      );
    }
    if (!globalThis.crypto?.subtle)
      throw new Error(
        "Open this project using localhost or HTTPS to create an account.",
      );
    const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
    const verifier = await passwordVerifier(password, salt);
    // Re-read after hashing so a second registration does not overwrite other users.
    const users = readAccounts();
    if (users.some((user) => user.email === email)) {
      throw new Error(
        "An account with this email already exists. Choose Sign in.",
      );
    }
    const user = { name, email, role, salt, verifier };
    await sendAccountConfirmation(email, name);
    const latestUsers = readAccounts();
    if (latestUsers.some((account) => account.email === email)) {
      throw new Error("An account with this email already exists. Choose Sign in.");
    }
    writeAccounts([...latestUsers, user]);
    startAccountSession(user);
  } catch (error) {
    accountError(
      error.message || "Your account could not be created. Please try again.",
    );
  } finally {
    setAccountBusy(false);
  }
}

async function submitLogin() {
  if (accountBusy) return;
  clearAccountFeedback();
  const form = document.getElementById("accountForm");
  const email = normaliseEmail(document.getElementById("accountEmail").value);
  const password = document.getElementById("accountPassword").value;
  document.getElementById("accountEmail").value = email;
  if (!form.reportValidity()) return;
  setAccountBusy(true, "Checking your account…");
  try {
    const user = readAccounts().find((account) => account.email === email);
    if (
      !user ||
      (await passwordVerifier(password, user.salt)) !== user.verifier
    ) {
      throw new Error(
        "The email or password is incorrect. Create an account first if you have not registered.",
      );
    }
    startAccountSession(user);
  } catch (error) {
    accountError(error.message || "Sign in failed. Please try again.");
  } finally {
    document.getElementById("accountPassword").value = "";
    setAccountBusy(false);
  }
}

function signOut() {
  if (accountBusy) return;
  try {
    sessionStorage.removeItem(SESSION_STORE);
  } catch {
    accountError(
      "Sign out could not be saved. Allow session storage and try again.",
    );
    return;
  }
  currentUser = null;
  updateAccountButton();
  document.getElementById("accountForm").reset();
  document.getElementById("registerForm").reset();
  setAccountMode("login");
  document.getElementById("accountStatus").textContent = "You have signed out.";
}

function restoreAccountSession() {
  try {
    const email = sessionStorage.getItem(SESSION_STORE);
    const user = email
      ? readAccounts().find((account) => account.email === email)
      : null;
    if (user)
      currentUser = {
        name: user.name,
        email: user.email,
        role: user.role === "seller" ? "seller" : "buyer",
      };
  } catch {
    currentUser = null;
  }
  updateAccountButton();
}

document.getElementById("accountModal").addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    closeAccount();
  }
  if (event.key !== "Tab") return;
  const panel = document.querySelector("#accountModal .account-panel");
  const controls = [
    ...panel.querySelectorAll("button:not(:disabled),input:not(:disabled)"),
  ].filter((el) => el.getClientRects().length > 0);
  if (!controls.length) {
    event.preventDefault();
    return;
  }
  const first = controls[0],
    last = controls[controls.length - 1];
  const active = document.activeElement;
  if (event.shiftKey && (active === first || !controls.includes(active))) {
    event.preventDefault();
    last.focus();
  } else if (
    !event.shiftKey &&
    (active === last || !controls.includes(active))
  ) {
    event.preventDefault();
    first.focus();
  }
});

if (window.location.protocol === "file:") {
  const notice = document.getElementById("accountNotice");
  notice.textContent = "You are viewing a local file preview. Email and password reset require the running app. ";
  const link = document.createElement("a");
  link.href = "http://127.0.0.1:4176/?page=account";
  link.textContent = "Open UniBasket";
  link.style.textDecoration = "underline";
  notice.append(link, ". Accounts saved in this file preview are separate from accounts in the running app.");
  const move = document.createElement("button");
  move.type = "button";
  move.className = "primary-button full-button";
  move.textContent = "Move saved accounts";
  move.addEventListener("click", moveFilePreviewAccounts);
  notice.append(document.createElement("br"), move);
}

restoreAccountSession();

const THEME_STORE = "unibasket-theme";
const themeToggle = document.getElementById("themeToggle");

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  themeToggle.setAttribute("aria-pressed", String(isDark));
  const nextMode = isDark ? "light" : "dark";
  themeToggle.setAttribute("aria-label", `Switch to ${nextMode} mode`);
  themeToggle.setAttribute("title", `Switch to ${nextMode} mode`);
}

function toggleTheme() {
  const nextTheme =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
  try {
    localStorage.setItem(THEME_STORE, nextTheme);
  } catch {
    // The selected theme can still be used when browser storage is blocked.
  }
}

let savedTheme = null;
try {
  savedTheme = localStorage.getItem(THEME_STORE);
} catch {
  // Use the system preference when browser storage is blocked.
}
const initialTheme =
  savedTheme === "dark" || savedTheme === "light"
    ? savedTheme
    : window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
applyTheme(initialTheme);

// Keep both sets of catalogue controls in sync on every screen size.
for (const [first, second, eventName] of [
  ["headerSearch", "search", "input"],
  ["headerCategory", "category", "change"],
]) {
  for (const [source, target] of [
    [first, second],
    [second, first],
  ]) {
    document.getElementById(source).addEventListener(eventName, (event) => {
      document.getElementById(target).value = event.target.value;
      render();
    });
  }
}
document.getElementById("sort").addEventListener("change", render);

document.querySelector(".header-search").addEventListener("submit", (event) => {
  event.preventDefault();
  navigateTo("products");
  document.getElementById("products").scrollIntoView({ behavior: "smooth" });
});

function toggleMobileMenu(open) {
  const header = document.querySelector(".site-header");
  const button = document.getElementById("menuButton");
  const expanded =
    typeof open === "boolean" ? open : !header.classList.contains("menu-open");
  header.classList.toggle("menu-open", expanded);
  button.setAttribute("aria-expanded", String(expanded));
  button.setAttribute("aria-label", expanded ? "Close menu" : "Open menu");
  button.querySelector(".menu-label").textContent = expanded ? "Close" : "Menu";
}

document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    document.querySelector(".site-header").classList.contains("menu-open")
  ) {
    toggleMobileMenu(false);
    document.getElementById("menuButton").focus();
  }
});

document.addEventListener("click", (event) => {
  const header = document.querySelector(".site-header");
  if (header.classList.contains("menu-open") && !header.contains(event.target))
    toggleMobileMenu(false);
});

window
  .matchMedia("(max-width: 48rem)")
  .addEventListener?.("change", (event) => {
    if (!event.matches) toggleMobileMenu(false);
  });

function navigateTo(page) {
  toggleMobileMenu(false);
  const target = page === "home" ? "./" : `?page=${encodeURIComponent(page)}`;
  history.pushState({ page }, "", target);
  applyRoute();
}

function navigateHome(event) {
  event.preventDefault();
  toggleMobileMenu(false);
  const homeLink = event.currentTarget;
  const homeUrl = new URL(
    homeLink instanceof HTMLAnchorElement ? homeLink.href : "./",
    window.location.href,
  );
  homeUrl.search = "";
  homeUrl.hash = "";
  history.pushState({ page: "home" }, "", homeUrl.href);
  applyRoute();
}

function applyRoute() {
  toggleMobileMenu(false);
  const page =
    new URLSearchParams(window.location.search).get("page") || "home";
  const activeNavPage =
    page === "categories"
      ? "categories"
      : page === "products"
        ? "products"
        : "home";
  const navLinks = {
    home: document.getElementById("homeNavLink"),
    products: document.getElementById("productsNavLink"),
    categories: document.getElementById("categoriesNavLink"),
  };
  for (const [name, link] of Object.entries(navLinks)) {
    const isActive = name === activeNavPage;
    link.classList.toggle("active", isActive);
    if (isActive) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  if (page === "seller" && (!currentUser || currentUser.role !== "seller")) {
    navigateTo("account");
    return;
  }
  const sections = {
    home: document.getElementById("top"),
    categories: document.getElementById("categories"),
    products: document.getElementById("products"),
  };
  for (const [name, section] of Object.entries(sections)) {
    section.style.display = page === "home" || page === name ? "" : "none";
  }
  document.body.dataset.page = page;
  if (page === "account" || page === "seller") {
    closeBasket();
    closeCheckout();
    openAccount();
    if (page === "seller" && currentUser) selectAccountRole("seller");
  } else if (page === "basket") {
    closeAccount();
    closeCheckout();
    openBasket();
  } else {
    if (!document.getElementById("accountModal").hidden) closeAccount();
    if (!document.getElementById("basketModal").hidden) closeBasket();
  }
  if (page === "home") window.scrollTo({ top: 0, behavior: "smooth" });
  else if (sections[page])
    sections[page].scrollIntoView({ behavior: "smooth" });
}

window.addEventListener("popstate", applyRoute);

document.getElementById("productCount").textContent = products.length;
// Anchor offsets follow the actual header height, including wrapped mobile controls.
if ("ResizeObserver" in window) {
  new ResizeObserver((entries) => {
    document.documentElement.style.setProperty(
      "--header-height",
      entries[0].target.offsetHeight + "px",
    );
  }).observe(document.querySelector(".site-header"));
}
render();
loadCatalogue();
applyRoute();
receiveFilePreviewAccounts();
