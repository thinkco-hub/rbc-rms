/**
 * An in-memory stand-in for the Django API, so component and hook tests run
 * the real data hooks (src/hooks/*) against backend-shaped responses without a
 * server. It is seeded from src/data and keeps the seed ids as-is (DRF accepts
 * the ids the UI sends back), so tests can still address "#1042" or "CL-001".
 *
 * It models the request/response contracts the hooks rely on, not the backend's
 * business rules in depth — those are covered by the Django test suite.
 */
import { BACKEND_ROLE_BY_UI } from "../api/roles";
import { initialCatalogue } from "../data/initialCatalogue";
import { initialClients } from "../data/initialClients";
import { initialIngredients, initialRestockReminders } from "../data/initialInventory";
import { initialOrders } from "../data/initialOrders";
import { initialUsers } from "../data/initialUsers";
import { verifyPassword } from "../utils/auth";
import { todayISO } from "../utils/dates";
import type {
  CatalogueItem,
  Client,
  IngredientStock,
  Order,
  OrderStatus,
  RestockReminder,
} from "../types/domain";

/** The collections the fake serves; each defaults to its src/data seed. */
export interface FakeApiSeed {
  catalogue?: CatalogueItem[];
  ingredients?: IngredientStock[];
  restockReminders?: RestockReminder[];
  clients?: Client[];
  orders?: Order[];
}

type Json = Record<string, unknown>;
type Id = string | number;

interface FakeEmployee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role_name: string;
  is_active: boolean;
  passwordHash?: string;
  password?: string;
}

const STATUS_TO_API: Record<OrderStatus, string> = {
  Pending: "pending",
  "In Production": "in_production",
  Ready: "ready",
  Delivered: "delivered",
};

const ROLE_NAMES = Object.values(BACKEND_ROLE_BY_UI);

const clientNumber = (id: string) => Number(id.replace(/^CL-/, ""));
const orderNumber = (id: string) => Number(id.replace(/^#/, ""));

function seed(source: FakeApiSeed = {}) {
  const catalogue = source.catalogue ?? initialCatalogue;
  const ingredients = source.ingredients ?? initialIngredients;
  const reminders = source.restockReminders ?? initialRestockReminders;
  const clients = source.clients ?? initialClients;
  const orders = source.orders ?? initialOrders;
  return {
    sessionUserId: null as string | null,
    failedAttempts: {} as Record<string, number>,
    lockedUntil: {} as Record<string, number>,
    nextId: 5000,
    employees: initialUsers.map(
      (u): FakeEmployee => ({
        id: u.id,
        first_name: u.name,
        last_name: "",
        email: u.email,
        phone: "",
        role_name: BACKEND_ROLE_BY_UI[u.role],
        is_active: u.active,
        passwordHash: u.passwordHash,
      })
    ),
    menuItems: catalogue.map((item) => ({
      id: item.id,
      name: item.name,
      unit: item.yieldUnit || "",
      selling_price: item.price,
      stock_quantity: item.qty,
      reorder_threshold: item.target,
      category: item.category,
      shelf_life: item.shelfLife,
    })),
    recipes: catalogue
      .filter((item) => item.ingredients.length > 0)
      .map((item, index) => ({
        id: index + 1,
        menu_item_id: item.id,
        name: item.name,
        yield_quantity: item.yieldQty ?? 1,
        yield_unit: item.yieldUnit ?? "",
        target_margin_percent: 40,
        ingredients: item.ingredients.map((line) => ({
          raw_material_id: line.ingredientId,
          quantity_required: line.qty,
          unit: line.unit,
        })),
      })),
    rawMaterials: ingredients.map((i) => ({
      id: i.id,
      name: i.name,
      unit: i.unit,
      supplier: i.supplier,
      unit_cost: i.unitCost,
      current_stock: i.qty,
      reorder_threshold: i.target,
    })),
    reminders: reminders.map((r) => ({
      id: r.id,
      raw_material_id: r.ingredientId,
      note: r.note,
      target_date: r.dueDate || null,
      status: r.done ? "completed" : "pending",
    })),
    clients: clients.map((c) => ({
      id: clientNumber(c.id),
      name: c.name,
      contact: c.contact,
      email: c.email,
      address: c.address,
      standing_order: c.standingOrder,
    })),
    orders: orders.map((o) => ({
      id: orderNumber(o.id),
      client_id: o.clientId ? clientNumber(o.clientId) : null,
      customer_name: o.customerName ?? "",
      status: STATUS_TO_API[o.status],
      requested_delivery_date: o.requestedDate,
      notes: o.notes,
      created_at: o.createdAt,
      delivered_at: o.deliveredAt,
      payment_method: o.paymentMethod,
      amount_paid: o.amountPaid,
      items: o.items.map((line, index) => ({
        id: index + 1,
        menu_item_id: line.menuItemId,
        quantity: line.qty,
        unit_price: line.unitPrice,
      })),
      delivery: o.deliveryDate
        ? { scheduled_date: o.deliveryDate, assigned_staff: o.assignedTo ?? "" }
        : null,
    })),
    transactions: [] as Json[],
  };
}

let db = seed();

/** Restores the src/data seed. The test setup calls it after every test. */
export function resetFakeApi() {
  db = seed();
}

/** Serves `source` instead of src/data, keeping the signed-in session. */
export function seedFakeApi(source: FakeApiSeed) {
  const session = db.sessionUserId;
  db = seed(source);
  db.sessionUserId = session;
}

/** Signs a seeded user in without the login form, for tests that start inside the app. */
export function signInFake(email: string) {
  const employee = db.employees.find((e) => e.email === email);
  if (!employee) throw new Error(`No seeded user ${email}`);
  db.sessionUserId = employee.id;
}

const roleId = (name: string) => ROLE_NAMES.indexOf(name) + 1;
const roleName = (id: Id) => ROLE_NAMES[Number(id) - 1];

const employeeJson = (e: FakeEmployee) => ({
  id: e.id,
  first_name: e.first_name,
  last_name: e.last_name,
  email: e.email,
  phone: e.phone,
  status: e.is_active ? "active" : "inactive",
  role_id: roleId(e.role_name),
  role_name: e.role_name,
  is_active: e.is_active,
});

const meJson = (e: FakeEmployee) => ({
  id: e.id,
  first_name: e.first_name,
  last_name: e.last_name,
  email: e.email,
  role_name: e.role_name,
  is_superuser: false,
});

function respond(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const same = (a: Id, b: Id) => String(a) === String(b);
const find = <T extends { id: Id }>(rows: T[], id: string) => rows.find((r) => same(r.id, id));

function menuItemFor(id: Id) {
  return db.menuItems.find((m) => same(m.id, id));
}

function orderItemsFrom(lines: Json[]) {
  return lines.map((line, index) => {
    const menuItem = menuItemFor(line.menu_item_id as Id);
    return {
      id: index + 1,
      menu_item_id: String(line.menu_item_id),
      quantity: Number(line.quantity),
      unit_price: menuItem ? menuItem.selling_price : 0,
    };
  });
}

async function handle(method: string, path: string, body: Json): Promise<Response> {
  const me = db.employees.find((e) => e.id === db.sessionUserId);
  const parts = path.replace(/^\/api\/v1\//, "").replace(/\/$/, "").split("/");
  const [app, resource, id, action] = parts;

  if (path.startsWith("/admin/")) return respond(200, {});

  // --- accounts ---
  if (app === "accounts" && resource === "login" && method === "POST") {
    const email = String(body.email ?? "").trim().toLowerCase();
    if ((db.lockedUntil[email] ?? 0) > Date.now()) {
      return respond(429, { detail: "Too many failed attempts.", locked_until: db.lockedUntil[email] });
    }
    const employee = db.employees.find((e) => e.email.toLowerCase() === email && e.is_active);
    const password = String(body.password ?? "");
    const valid = employee
      ? employee.password !== undefined
        ? employee.password === password
        : !!employee.passwordHash && (await verifyPassword(password, employee.passwordHash))
      : false;
    if (!employee || !valid) {
      db.failedAttempts[email] = (db.failedAttempts[email] ?? 0) + 1;
      if (db.failedAttempts[email] >= 5) {
        db.lockedUntil[email] = Date.now() + 60_000;
        db.failedAttempts[email] = 0;
        return respond(429, { detail: "Too many failed attempts.", locked_until: db.lockedUntil[email] });
      }
      return respond(400, { detail: "Invalid email or password." });
    }
    db.failedAttempts[email] = 0;
    db.sessionUserId = employee.id;
    return respond(200, meJson(employee));
  }
  if (!me) return respond(403, { detail: "Authentication credentials were not provided." });

  if (app === "accounts") {
    if (resource === "logout") {
      db.sessionUserId = null;
      return respond(200, {});
    }
    if (resource === "me") return respond(200, meJson(me));
    if (resource === "roles") {
      return respond(200, ROLE_NAMES.map((name) => ({ id: roleId(name), role_name: name, description: "" })));
    }
    if (resource === "employees") {
      if (!id && method === "GET") return respond(200, db.employees.map(employeeJson));
      if (!id && method === "POST") {
        const created: FakeEmployee = {
          id: String(db.nextId++),
          first_name: String(body.first_name),
          last_name: String(body.last_name),
          email: String(body.email),
          phone: String(body.phone ?? ""),
          role_name: roleName(body.role_id as Id),
          is_active: true,
          password: String(body.password),
        };
        db.employees.push(created);
        return respond(201, employeeJson(created));
      }
      const employee = find(db.employees, id);
      if (!employee) return respond(404, { detail: "Not found." });
      if (action === "activate" || action === "deactivate") {
        employee.is_active = action === "activate";
      } else if (method === "PATCH" && body.role_id !== undefined) {
        employee.role_name = roleName(body.role_id as Id);
      }
      return respond(200, employeeJson(employee));
    }
  }

  // --- inventory & recipes ---
  if (app === "inventory" && resource === "menu-items") {
    if (!id && method === "GET") return respond(200, db.menuItems);
    if (!id && method === "POST") {
      const created = { ...(body as Json), id: String(db.nextId++) } as (typeof db.menuItems)[number];
      db.menuItems.push(created);
      return respond(201, created);
    }
    const item = find(db.menuItems, id);
    if (!item) return respond(404, { detail: "Not found." });
    if (action === "restock") {
      item.stock_quantity = Number(item.stock_quantity) + Number(body.quantity);
      return respond(200, item);
    }
    Object.assign(item, body);
    return respond(200, item);
  }
  if (app === "recipes") {
    const recipeId = resource;
    const withLines = (b: Json) => ({
      ...b,
      ingredients: ((b.ingredients as Json[]) ?? []).map((line) => ({
        ...line,
        unit: db.rawMaterials.find((r) => same(r.id, line.raw_material_id as Id))?.unit ?? "",
      })),
    });
    if (!recipeId && method === "GET") return respond(200, db.recipes);
    if (!recipeId && method === "POST") {
      const created = { ...withLines(body), id: db.nextId++ } as (typeof db.recipes)[number];
      db.recipes.push(created);
      return respond(201, created);
    }
    const recipe = find(db.recipes, recipeId);
    if (!recipe) return respond(404, { detail: "Not found." });
    Object.assign(recipe, withLines(body));
    return respond(200, recipe);
  }
  if (app === "inventory" && resource === "raw-materials") {
    if (!id && method === "GET") return respond(200, db.rawMaterials);
    if (!id && method === "POST") {
      const created = { ...(body as Json), id: String(db.nextId++), current_stock: 0 } as (typeof db.rawMaterials)[number];
      db.rawMaterials.push(created);
      return respond(201, created);
    }
    const material = find(db.rawMaterials, id);
    if (!material) return respond(404, { detail: "Not found." });
    if (action === "consume") {
      material.current_stock = Number(material.current_stock) - Number(body.quantity);
      return respond(200, { raw_material: material });
    }
    Object.assign(material, body);
    return respond(200, material);
  }
  if (app === "inventory" && resource === "receipts" && method === "POST") {
    const material = find(db.rawMaterials, String(body.raw_material_id));
    if (!material) return respond(400, { raw_material_id: ["Invalid pk."] });
    material.current_stock = Number(material.current_stock) + Number(body.quantity);
    return respond(201, { raw_material: material });
  }
  if (app === "inventory" && resource === "reminders") {
    if (!id && method === "GET") return respond(200, db.reminders);
    if (!id && method === "POST") {
      const created = { ...(body as Json), id: String(db.nextId++), status: "pending" } as (typeof db.reminders)[number];
      db.reminders.push(created);
      return respond(201, created);
    }
    const reminder = find(db.reminders, id);
    if (!reminder) return respond(404, { detail: "Not found." });
    Object.assign(reminder, body);
    return respond(200, reminder);
  }

  // --- clients & orders ---
  if (app === "orders" && resource === "clients") {
    if (!id && method === "GET") return respond(200, db.clients);
    if (!id && method === "POST") {
      const created = { ...(body as Json), id: db.clients.length + 1 } as (typeof db.clients)[number];
      db.clients.push(created);
      return respond(201, created);
    }
    const client = find(db.clients, id);
    if (!client) return respond(404, { detail: "Not found." });
    Object.assign(client, body);
    return respond(200, client);
  }
  if (app === "orders" && resource === "orders") {
    if (!id && method === "GET") return respond(200, db.orders);
    if (!id && method === "POST") {
      const created = {
        id: db.nextId++,
        client_id: (body.client_id as number | null) ?? null,
        customer_name: String(body.customer_name ?? ""),
        status: "pending",
        requested_delivery_date: (body.requested_delivery_date as string) ?? null,
        notes: String(body.notes ?? ""),
        created_at: todayISO(),
        delivered_at: null,
        payment_method: null,
        amount_paid: 0,
        items: orderItemsFrom((body.items as Json[]) ?? []),
        delivery: null,
      } as (typeof db.orders)[number];
      db.orders.unshift(created);
      return respond(201, created);
    }
    const order = find(db.orders, id);
    if (!order) return respond(404, { detail: "Not found." });
    if (method === "PATCH") {
      if (body.customer_name !== undefined) order.customer_name = String(body.customer_name);
      if (body.items) order.items = orderItemsFrom(body.items as Json[]);
    } else if (action === "advance_status") {
      order.status = String(body.status);
    } else if (action === "schedule_delivery") {
      order.delivery = {
        scheduled_date: String(body.delivery_date),
        assigned_staff: String(body.assigned_to),
      };
    } else if (action === "record_payment") {
      order.payment_method = body.method as (typeof order)["payment_method"];
      order.amount_paid = Number(order.amount_paid) + Number(body.amount);
    } else if (action === "mark_delivered" && order.status !== "delivered") {
      for (const line of order.items) {
        const menuItem = menuItemFor(line.menu_item_id);
        if (menuItem) menuItem.stock_quantity = Math.max(0, Number(menuItem.stock_quantity) - line.quantity);
      }
      order.status = "delivered";
      order.delivered_at = todayISO();
    }
    return respond(200, order);
  }

  // --- POS ---
  if (app === "pos" && resource === "products") {
    return respond(
      200,
      db.menuItems.map((m) => ({
        id: m.id,
        name: m.name,
        selling_price: m.selling_price,
        category: m.category,
        unit: m.unit,
        available_stock: m.stock_quantity,
      }))
    );
  }
  if (app === "pos" && resource === "transactions") {
    if (!id && method === "GET") return respond(200, db.transactions);
    if (id) {
      const tx = db.transactions.find((t) => same(t.id as Id, id));
      return tx ? respond(200, tx) : respond(404, { detail: "Not found." });
    }
    const replay = db.transactions.find((t) => t.idempotency_key === body.idempotency_key);
    if (replay) return respond(201, replay);

    const lines = (body.items as Json[]).map((line) => {
      const menuItem = menuItemFor(line.menu_item_id as Id);
      const quantity = Number(line.quantity);
      const price = menuItem ? Number(menuItem.selling_price) : 0;
      return {
        menu_item_id: line.menu_item_id,
        item_name: menuItem?.name ?? "",
        unit: menuItem?.unit ?? "",
        quantity,
        unit_price: price,
        line_total: price * quantity,
      };
    });
    const subtotal = lines.reduce((sum, l) => sum + l.line_total, 0);
    const tax = subtotal * 0.05;
    const deliveryDate = (body.delivery_date as string | null) ?? null;
    const isPreOrder = !!deliveryDate && deliveryDate > todayISO();

    let orderId: number | null = null;
    if (isPreOrder) {
      orderId = db.nextId++;
      db.orders.unshift({
        id: orderId,
        client_id: null,
        customer_name: String(body.customer_name),
        status: "pending",
        requested_delivery_date: deliveryDate,
        notes: String(body.notes ?? ""),
        created_at: todayISO(),
        delivered_at: null,
        payment_method: body.payment_method as (typeof db.orders)[number]["payment_method"],
        amount_paid: subtotal + tax,
        items: orderItemsFrom(body.items as Json[]),
        delivery: { scheduled_date: deliveryDate, assigned_staff: "" },
      });
    } else {
      for (const line of lines) {
        const menuItem = menuItemFor(line.menu_item_id as Id);
        if (menuItem) menuItem.stock_quantity = Math.max(0, Number(menuItem.stock_quantity) - line.quantity);
      }
    }

    const tx: Json = {
      id: db.nextId++,
      order_id: orderId,
      status: "completed",
      payment_method: body.payment_method,
      payment_reference: "",
      subtotal,
      discount_amount: 0,
      tax_rate: 5,
      tax_amount: tax,
      total_amount: subtotal + tax,
      customer_name: body.customer_name,
      customer_contact: body.customer_contact ?? "",
      notes: body.notes ?? "",
      delivery_date: deliveryDate,
      transaction_timestamp: new Date().toISOString(),
      items: lines,
      idempotency_key: body.idempotency_key,
    };
    db.transactions.unshift(tx);
    return respond(201, tx);
  }

  return respond(404, { detail: `Fake API has no route for ${method} ${path}` });
}

/** A `fetch` that routes /api/v1 and /admin requests to the in-memory backend. */
export async function fakeFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = new URL(typeof input === "string" ? input : input.toString(), "http://localhost");
  const method = (init.method ?? "GET").toUpperCase();
  const body = typeof init.body === "string" && init.body ? (JSON.parse(init.body) as Json) : {};
  return handle(method, url.pathname, body);
}
