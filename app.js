const searchForm = document.querySelector("#searchForm");
const searchInput = document.querySelector("#searchInput");
const status = document.querySelector("#status");
const bookList = document.querySelector("#bookList");
const authForms = document.querySelector("#authForms");
const signUpForm = document.querySelector("#signUpForm");
const signInForm = document.querySelector("#signInForm");
const signUpButton = document.querySelector("#signUpButton");
const signInButton = document.querySelector("#signInButton");
const logoutButton = document.querySelector("#logoutButton");
const accountEmail = document.querySelector("#accountEmail");
const authStatus = document.querySelector("#authStatus");
const purchaseStatus = document.querySelector("#purchaseStatus");
const ordersStatus = document.querySelector("#ordersStatus");
const ordersList = document.querySelector("#ordersList");

let currentSession = null;
let orderRequestId = 0;

function setStatus(message, isError = false) { status.textContent = message; status.classList.toggle("is-error", isError); }
function setAuthStatus(message, isError = false) { authStatus.textContent = message; authStatus.classList.toggle("is-error", isError); }
function setPurchaseStatus(message, isError = false) { purchaseStatus.textContent = message; purchaseStatus.classList.toggle("is-error", isError); }
function setOrdersStatus(message, isError = false) { ordersStatus.textContent = message; ordersStatus.classList.toggle("is-error", isError); }
function setAuthButtonsDisabled(disabled) { signUpButton.disabled = disabled; signInButton.disabled = disabled; logoutButton.disabled = disabled; }
function hasSupabaseSettings() { return !SUPABASE_URL.includes("YOUR_PROJECT_REF") && SUPABASE_PUBLISHABLE_KEY !== "YOUR_PUBLISHABLE_KEY"; }

function clearOrders(message = "로그인하면 내 주문을 확인할 수 있습니다.") {
  orderRequestId += 1;
  ordersList.replaceChildren();
  setOrdersStatus(message);
}

function renderAuthState(session) {
  const previousUserId = currentSession?.user?.id || "";
  const nextUserId = session?.user?.id || "";
  currentSession = session;
  const email = session?.user?.email;
  const isLoggedIn = Boolean(email);
  authForms.hidden = isLoggedIn;
  logoutButton.hidden = !isLoggedIn;
  accountEmail.textContent = isLoggedIn ? email + "님이 로그인했습니다." : "로그인하면 구매 기능을 이용할 수 있습니다.";
  if (previousUserId !== nextUserId) clearOrders(isLoggedIn ? "내 주문을 불러올 준비를 합니다." : "로그인하면 내 주문을 확인할 수 있습니다.");
}

function formatPrice(price) {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(price);
}
function formatDate(dateText) {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(dateText));
}

function renderBooks(books) {
  bookList.replaceChildren();
  if (!books.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "검색 결과가 없습니다.";
    bookList.append(empty);
    return;
  }

  books.forEach((book) => {
    const card = document.createElement("article");
    card.className = "book-card";
    const number = document.createElement("p"); number.className = "book-number"; number.textContent = "도서 번호 " + book.id;
    const title = document.createElement("h2"); title.className = "book-title"; title.textContent = book.title;
    const author = document.createElement("p"); author.className = "book-author"; author.textContent = "저자: " + book.author;
    const price = document.createElement("p"); price.className = "book-price"; price.textContent = formatPrice(book.price);

    const purchaseRow = document.createElement("div"); purchaseRow.className = "purchase-row";
    const quantityField = document.createElement("div"); quantityField.className = "quantity-field";
    const quantityLabel = document.createElement("label");
    const quantityId = "quantity-" + book.id;
    quantityLabel.htmlFor = quantityId; quantityLabel.textContent = "수량 (1~10권)";
    const quantityInput = document.createElement("input");
    quantityInput.id = quantityId; quantityInput.type = "number"; quantityInput.min = "1"; quantityInput.max = "10"; quantityInput.step = "1"; quantityInput.value = "1"; quantityInput.inputMode = "numeric";
    quantityInput.setAttribute("aria-label", book.title + " 구매 수량");
    quantityField.append(quantityLabel, quantityInput);
    const purchaseButton = document.createElement("button");
    purchaseButton.type = "button"; purchaseButton.textContent = "모의 구매";
    purchaseButton.addEventListener("click", () => purchaseBook(book, quantityInput, purchaseButton));
    purchaseRow.append(quantityField, purchaseButton);
    card.append(number, title, author, price, purchaseRow);
    bookList.append(card);
  });
}

async function loadBooks(keyword = "") {
  if (!hasSupabaseSettings()) { setStatus("config.js에 Supabase Project URL과 Publishable key를 먼저 입력해 주세요.", true); return; }
  setStatus("도서 목록을 불러오는 중입니다.");
  bookList.replaceChildren();
  let query = sb.from("books").select("id, title, author, price").order("id", { ascending: true });
  if (keyword) query = query.ilike("title", "%" + keyword + "%");
  const { data, error } = await query;
  if (error) { console.error(error); setStatus("도서 목록을 불러오지 못했습니다. Supabase 설정과 RLS 정책을 확인해 주세요.", true); return; }
  renderBooks(data);
  setStatus(data.length + "권의 도서를 표시합니다.");
}

function renderOrders(orders) {
  ordersList.replaceChildren();
  if (!orders.length) {
    const empty = document.createElement("p"); empty.className = "empty"; empty.textContent = "아직 모의 구매한 도서가 없습니다."; ordersList.append(empty); return;
  }
  orders.forEach((order) => {
    const item = document.createElement("article"); item.className = "order-item";
    const details = document.createElement("div");
    const title = document.createElement("h3"); title.textContent = order.book_title;
    const quantity = document.createElement("p"); quantity.textContent = "수량: " + order.quantity + "권 · 단가: " + formatPrice(order.unit_price);
    const createdAt = document.createElement("p"); createdAt.textContent = "주문 시각: " + formatDate(order.created_at);
    details.append(title, quantity, createdAt);
    const total = document.createElement("p"); total.className = "order-total"; total.textContent = "금액: " + formatPrice(order.unit_price * order.quantity);
    item.append(details, total); ordersList.append(item);
  });
}

async function loadOrders(userId) {
  if (!hasSupabaseSettings() || !userId) return;
  const requestId = ++orderRequestId;
  setOrdersStatus("내 주문을 불러오는 중입니다.");
  const { data, error } = await sb
    .from("orders")
    .select("book_title, quantity, unit_price, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  // 로그아웃 또는 다른 회원 로그인 후 도착한 이전 응답은 표시하지 않습니다.
  if (requestId !== orderRequestId || currentSession?.user?.id !== userId) return;
  if (error) { console.error(error); setOrdersStatus("내 주문을 불러오지 못했습니다. 로그인 상태와 RLS 정책을 확인해 주세요.", true); return; }
  renderOrders(data);
  setOrdersStatus(data.length + "건의 주문을 표시합니다.");
}

async function purchaseBook(book, quantityInput, purchaseButton) {
  const userId = currentSession?.user?.id;
  if (!userId) {
    setAuthStatus("모의 구매하려면 먼저 로그인해 주세요.", true);
    document.querySelector("#authHeading").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  const quantity = Number(quantityInput.value);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    setPurchaseStatus("수량은 1부터 10 사이의 정수로 입력해 주세요.", true); quantityInput.focus(); return;
  }
  const expectedTotal = book.price * quantity;
  const confirmed = window.confirm("도서명: " + book.title + "\n수량: " + quantity + "권\n예상 금액: " + formatPrice(expectedTotal) + "\n\n모의 구매하시겠습니까?");
  if (!confirmed) return;
  purchaseButton.disabled = true;
  setPurchaseStatus("모의 구매를 처리하는 중입니다.");
  const { error } = await sb.rpc("purchase_book", { p_book_id: book.id, p_quantity: quantity });
  purchaseButton.disabled = false;
  if (currentSession?.user?.id !== userId) return;
  if (error) { console.error(error); setPurchaseStatus("모의 구매에 실패했습니다. 다시 시도해 주세요.", true); return; }
  setPurchaseStatus("모의 구매가 완료되었습니다.");
  loadOrders(userId);
}

async function restoreSession() {
  if (!hasSupabaseSettings()) return;
  const { data, error } = await sb.auth.getSession();
  if (error) { console.error(error); setAuthStatus("로그인 상태를 확인하지 못했습니다. 다시 로그인해 주세요.", true); return; }
  renderAuthState(data.session);
  if (data.session?.user?.id) loadOrders(data.session.user.id);
}

signUpForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!hasSupabaseSettings()) { setAuthStatus("config.js에 Supabase 설정을 먼저 입력해 주세요.", true); return; }
  const values = new FormData(signUpForm); setAuthButtonsDisabled(true); setAuthStatus("회원가입을 처리하는 중입니다.");
  const { data, error } = await sb.auth.signUp({ email: values.get("email"), password: values.get("password") });
  setAuthButtonsDisabled(false);
  if (error) { console.error(error); setAuthStatus("회원가입에 실패했습니다. 이메일과 비밀번호를 확인해 주세요.", true); return; }
  signUpForm.reset();
  if (!data.session) { setAuthStatus("회원가입이 완료되었습니다. 이메일 확인 후 로그인해 주세요."); return; }
  setAuthStatus("회원가입과 로그인이 완료되었습니다."); renderAuthState(data.session); loadOrders(data.session.user.id);
});

signInForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!hasSupabaseSettings()) { setAuthStatus("config.js에 Supabase 설정을 먼저 입력해 주세요.", true); return; }
  const values = new FormData(signInForm); setAuthButtonsDisabled(true); setAuthStatus("로그인하는 중입니다.");
  const { data, error } = await sb.auth.signInWithPassword({ email: values.get("email"), password: values.get("password") });
  setAuthButtonsDisabled(false);
  if (error) { console.error(error); setAuthStatus("로그인에 실패했습니다. 이메일과 비밀번호를 확인해 주세요.", true); return; }
  signInForm.reset(); setAuthStatus("로그인했습니다."); renderAuthState(data.session); loadOrders(data.session.user.id);
});

logoutButton.addEventListener("click", async () => {
  if (!hasSupabaseSettings()) return;
  clearOrders(); // 로그아웃을 누르는 즉시 이전 주문을 지웁니다.
  setAuthButtonsDisabled(true);
  const { error } = await sb.auth.signOut();
  setAuthButtonsDisabled(false);
  if (error) { console.error(error); setAuthStatus("로그아웃하지 못했습니다. 다시 시도해 주세요.", true); if (currentSession?.user?.id) loadOrders(currentSession.user.id); return; }
  setAuthStatus("로그아웃했습니다."); renderAuthState(null);
});

// 콜백에서는 화면 상태와 주문 목록 초기화만 처리하고 비동기 요청을 기다리지 않습니다.
sb.auth.onAuthStateChange((_event, session) => { renderAuthState(session); });

searchForm.addEventListener("submit", (event) => { event.preventDefault(); loadBooks(searchInput.value.trim()); });

loadBooks();
restoreSession();
