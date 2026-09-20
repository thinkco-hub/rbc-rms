CREATE TABLE role (
    role_id      SERIAL PRIMARY KEY,
    role_name    VARCHAR(100) NOT NULL UNIQUE,
    description  TEXT
);

CREATE TABLE permission (
    perm_id            SERIAL PRIMARY KEY,
    permission_name    VARCHAR(100) NOT NULL UNIQUE,
    description        TEXT
);

CREATE TABLE role_permission (
    role_id      INTEGER NOT NULL REFERENCES role(role_id) ON DELETE CASCADE,
    perm_id      INTEGER NOT NULL REFERENCES permission(perm_id) ON DELETE CASCADE,
    description  TEXT,
    PRIMARY KEY (role_id, perm_id)
);

CREATE TABLE employee (
    emp_id       SERIAL PRIMARY KEY,
    role_id      INTEGER NOT NULL REFERENCES role(role_id) ON DELETE RESTRICT,
    first_name   VARCHAR(100) NOT NULL,
    last_name    VARCHAR(100) NOT NULL,
    email        VARCHAR(255) NOT NULL UNIQUE,
    phone        VARCHAR(30),
    status       VARCHAR(20) NOT NULL DEFAULT 'active'
);

CREATE TABLE raw_material (
    raw_material_id     SERIAL PRIMARY KEY,
    name                VARCHAR(150) NOT NULL,
    unit                VARCHAR(20) NOT NULL,
    current_stock       NUMERIC(12,3) NOT NULL DEFAULT 0,
    reorder_threshold   NUMERIC(12,3) NOT NULL DEFAULT 0
);

CREATE TABLE cost_layer (
    cost_layer_id       SERIAL PRIMARY KEY,
    raw_material_id     INTEGER NOT NULL REFERENCES raw_material(raw_material_id) ON DELETE CASCADE,
    quantity_remaining  NUMERIC(12,3) NOT NULL,
    unit_cost           NUMERIC(12,2) NOT NULL,
    received_date       DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE restock_reminder (
    restock_reminder_id  SERIAL PRIMARY KEY,
    raw_material_id      INTEGER NOT NULL REFERENCES raw_material(raw_material_id) ON DELETE CASCADE,
    quantity_needed      NUMERIC(12,3) NOT NULL,
    target_date          DATE,
    status               VARCHAR(20) NOT NULL DEFAULT 'pending'
);

CREATE TABLE menu_item (
    menu_item_id        SERIAL PRIMARY KEY,
    name                VARCHAR(150) NOT NULL,
    stock_quantity      NUMERIC(12,2) NOT NULL DEFAULT 0,
    description         TEXT,
    unit                VARCHAR(20),
    reorder_threshold   NUMERIC(12,2) NOT NULL DEFAULT 0,
    selling_price       NUMERIC(12,2) NOT NULL
);

-- NOTE: no resolution/status workflow field (Pending/Applied/Dismissed) in
-- this version of the diagram — flagged for confirmation, see chat.
CREATE TABLE closing_inventory (
    closing_inventory_id  SERIAL PRIMARY KEY,
    menu_item_id          INTEGER NOT NULL REFERENCES menu_item(menu_item_id) ON DELETE RESTRICT,
    emp_id                INTEGER REFERENCES employee(emp_id) ON DELETE SET NULL,
    inventory_date        DATE NOT NULL,
    expected_quantity     NUMERIC(12,2) NOT NULL,
    actual_quantity       NUMERIC(12,2) NOT NULL,
    discrepancy_quantity  NUMERIC(12,2) NOT NULL,
    submitted_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE recipe (
    recipe_id      SERIAL PRIMARY KEY,
    menu_item_id   INTEGER NOT NULL REFERENCES menu_item(menu_item_id) ON DELETE CASCADE
);

CREATE TABLE recipe_ingredient (
    recipe_ingredient_id  SERIAL PRIMARY KEY,
    recipe_id             INTEGER NOT NULL REFERENCES recipe(recipe_id) ON DELETE CASCADE,
    raw_material_id       INTEGER NOT NULL REFERENCES raw_material(raw_material_id) ON DELETE RESTRICT,
    quantity_required     NUMERIC(12,3) NOT NULL
);

CREATE TABLE production_run (
    production_id     SERIAL PRIMARY KEY,
    menu_item_id      INTEGER NOT NULL REFERENCES menu_item(menu_item_id) ON DELETE RESTRICT,
    recipe_id         INTEGER NOT NULL REFERENCES recipe(recipe_id) ON DELETE RESTRICT,
    emp_id            INTEGER REFERENCES employee(emp_id) ON DELETE SET NULL,
    planned_quantity  NUMERIC(12,2) NOT NULL,
    actual_quantity   NUMERIC(12,2),
    planned_date      DATE NOT NULL,
    completed_date    DATE,
    status            VARCHAR(20) NOT NULL DEFAULT 'scheduled'
);

CREATE TABLE production_consumption (
    consumption_id      SERIAL PRIMARY KEY,
    production_id       INTEGER NOT NULL REFERENCES production_run(production_id) ON DELETE CASCADE,
    raw_material_id     INTEGER NOT NULL REFERENCES raw_material(raw_material_id) ON DELETE RESTRICT,
    quantity_consumed   NUMERIC(12,3) NOT NULL,
    unit_cost           NUMERIC(12,2) NOT NULL,
    total_cost          NUMERIC(12,2) NOT NULL
);

CREATE TABLE client (
    client_id      SERIAL PRIMARY KEY,
    name           VARCHAR(150) NOT NULL,
    address        VARCHAR(255),
    contact_info   VARCHAR(150)
);

-- "order" is a reserved SQL keyword — quoted throughout.
CREATE TABLE "order" (
    order_id                  SERIAL PRIMARY KEY,
    client_id                 INTEGER NOT NULL REFERENCES client(client_id) ON DELETE RESTRICT,
    status                    VARCHAR(20) NOT NULL DEFAULT 'pending',
    requested_delivery_date   DATE
);

CREATE TABLE order_item (
    order_item_id   SERIAL PRIMARY KEY,
    order_id        INTEGER NOT NULL REFERENCES "order"(order_id) ON DELETE CASCADE,
    menu_item_id    INTEGER NOT NULL REFERENCES menu_item(menu_item_id) ON DELETE RESTRICT,
    quantity        NUMERIC(12,2) NOT NULL
);

CREATE TABLE delivery (
    delivery_id      SERIAL PRIMARY KEY,
    order_id         INTEGER NOT NULL REFERENCES "order"(order_id) ON DELETE CASCADE,
    scheduled_date   DATE NOT NULL,
    assigned_staff   VARCHAR(150),
    status           VARCHAR(20) NOT NULL DEFAULT 'scheduled'
);

CREATE TABLE pos_transaction (
    transaction_id    SERIAL PRIMARY KEY,
    cashier_id        INTEGER REFERENCES employee(emp_id) ON DELETE SET NULL,
    order_id          INTEGER REFERENCES "order"(order_id) ON DELETE SET NULL,
    subtotal          NUMERIC(12,2) NOT NULL,
    discount_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_amount      NUMERIC(12,2) NOT NULL,
    payment_method    VARCHAR(20) NOT NULL,
    status            VARCHAR(20) NOT NULL DEFAULT 'completed',
    voided_at         TIMESTAMPTZ,
    refunded_at       TIMESTAMPTZ
);

CREATE TABLE pos_transaction_item (
    transaction_item_id  SERIAL PRIMARY KEY,
    transaction_id       INTEGER NOT NULL REFERENCES pos_transaction(transaction_id) ON DELETE CASCADE,
    menu_item_id         INTEGER NOT NULL REFERENCES menu_item(menu_item_id) ON DELETE RESTRICT,
    quantity             NUMERIC(12,2) NOT NULL,
    unit_price           NUMERIC(12,2) NOT NULL,
    discount_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
    line_total           NUMERIC(12,2) NOT NULL,
    unit_cogs            NUMERIC(12,2) NOT NULL,
    total_cogs           NUMERIC(12,2) NOT NULL
);

-- NOTE: branch_ledger.branch_id references chams_inventory_id below —
-- naming mismatch from the original diagram, flagged for confirmation.
CREATE TABLE chams_inventory (
    chams_inventory_id  SERIAL PRIMARY KEY,
    name                VARCHAR(150) NOT NULL
);

CREATE TABLE branch_ledger (
    branch_ledger_id         SERIAL PRIMARY KEY,
    branch_id                INTEGER NOT NULL REFERENCES chams_inventory(chams_inventory_id) ON DELETE CASCADE,
    month                    DATE NOT NULL,
    beginning_stock          NUMERIC(12,2) NOT NULL DEFAULT 0,
    restocked                NUMERIC(12,2) NOT NULL DEFAULT 0,
    spoilage                 NUMERIC(12,2) NOT NULL DEFAULT 0,
    sold                     NUMERIC(12,2) NOT NULL DEFAULT 0,
    remaining                NUMERIC(12,2) NOT NULL DEFAULT 0,
    branch_submitted_count   NUMERIC(12,2)
);

CREATE TABLE expense (
    expense_id     SERIAL PRIMARY KEY,
    emp_id         INTEGER REFERENCES employee(emp_id) ON DELETE SET NULL,
    expense_date   DATE NOT NULL,
    description    TEXT,
    category       VARCHAR(100),
    amount         NUMERIC(12,2) NOT NULL
);

CREATE TABLE calendar_event (
    calendar_event_id  SERIAL PRIMARY KEY,
    event_type         VARCHAR(30) NOT NULL,
    reference_id       INTEGER NOT NULL,
    google_event_id    VARCHAR(255) NOT NULL,
    status             VARCHAR(20) NOT NULL DEFAULT 'active'
);