// services/approvalWorkflow.service.js
//
// CTO/Wellness approval workflow. One workflow per employee.
//
// How an employee's workflow is chosen:
//   1. Their own private route (isPublic: false, createdBy = them)  → "personal"
//   2. First matching assignment, in SCOPE_CONFIG order              → "assigned"
//      employee → project → designation → company default ("global")
//   3. Nothing                                                       → "none"
//
// Shared workflows ("templates") are routes created through /templates
// (permission settings.cto_workflow_assign). They're stored as normal public
// ApprovalRoutes, plus an entry in a small registry, so only they can be
// assigned. An employee's own public route can never be assigned to others.
// "Reset to default" deletes the employee's private route so the assigned one
// applies again.
const mongoose = require("mongoose");
const ApprovalRoute = require("../models/approvalRouteModel");
const Employee = require("../models/employeeModel");
const {
  createApprovalRouteService,
  updateApprovalRouteService,
} = require("./approvalRoute.service");

/* ═══ config ═════════════════════════════════════════════════════════ */

const WORKFLOW_CATEGORY = "cto_wellness";

// ORDER = PRECEDENCE. `field` is the path on Employee (arrays and ObjectId
// refs both work). A scope whose field isn't on the Employee schema is
// skipped. Add e.g. { scope: "department", field: "department" } if needed.
const SCOPE_CONFIG = [
  { scope: "employee", field: "_id" },
  {
    scope: "project",
    field: "project",
    labelFields: ["name", "projectName", "title", "code"],
  },
  {
    scope: "designation",
    field: "designation",
    labelFields: ["name", "title"],
  },
  { scope: "global", field: null },
];
const GLOBAL_VALUE = "*";
const MAX_PAGE_SIZE = 100;

const PERSONAL = { isPublic: false, category: WORKFLOW_CATEGORY };

const ROUTE_POPULATE = [
  { path: "steps.approver", select: "firstName lastName position designation" },
  {
    path: "notifiedEmployees",
    select: "firstName lastName position designation",
  },
  { path: "createdBy", select: "firstName lastName position" },
];

/* ═══ assignment collection ══════════════════════════════════════════ */
// One template per (scope, value): one per employee, one per project, one per
// designation, one company default. Move this to models/ if you prefer.

const assignmentSchema = new mongoose.Schema(
  {
    route: {
      type: mongoose.Schema.Types.ObjectId,
      ref: ApprovalRoute.modelName,
      required: true,
      index: true,
    },
    scope: {
      type: String,
      enum: SCOPE_CONFIG.map((s) => s.scope),
      required: true,
    },
    // employee → employee _id | project/designation → value stored on the employee | global → "*"
    value: { type: String, required: true, trim: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
  },
  { timestamps: true },
);
assignmentSchema.index({ scope: 1, value: 1 }, { unique: true });

const Assignment =
  mongoose.models.ApprovalRouteAssignment ||
  mongoose.model("ApprovalRouteAssignment", assignmentSchema);

/* ═══ shared-workflow registry ═══════════════════════════════════════ */
// Marks which ApprovalRoutes are shared workflows, without touching your model.

const templateSchema = new mongoose.Schema(
  {
    route: {
      type: mongoose.Schema.Types.ObjectId,
      ref: ApprovalRoute.modelName,
      required: true,
      unique: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
  },
  { timestamps: true },
);

const WorkflowTemplate =
  mongoose.models.ApprovalWorkflowTemplate ||
  mongoose.model("ApprovalWorkflowTemplate", templateSchema);

/* ═══ settings ═══════════════════════════════════════════════════════ */
// One switch for HR: use shared workflows, or only each employee's own.
// When off, assignments (employee/project/designation/company default) are
// kept but ignored, so turning it back on restores everything.

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true }, // WORKFLOW_CATEGORY
    sharedWorkflowsEnabled: { type: Boolean, default: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
  },
  { timestamps: true },
);

const WorkflowSettings =
  mongoose.models.ApprovalWorkflowSettings ||
  mongoose.model("ApprovalWorkflowSettings", settingsSchema);

async function readSettings() {
  const doc = await WorkflowSettings.findOne({ key: WORKFLOW_CATEGORY }).lean();
  return {
    sharedWorkflowsEnabled: doc?.sharedWorkflowsEnabled !== false, // on unless HR turned it off
    updatedAt: doc?.updatedAt || null,
    updatedBy: doc?.updatedBy || null,
  };
}

/* ═══ notify groups ══════════════════════════════════════════════════ */
// Who gets NOTIFIED (no approval) when an employee files a request, set
// separately from the workflow so each employee can have different people.
// An employee can be in several groups; everyone in all of them is notified.

const notifyGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    notifiedEmployees: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    ],
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "Employee" }],
    // true  → employees can't remove these people from their requests
    // false → each employee can remove them from their OWN requests
    locked: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
  },
  { timestamps: true },
);
notifyGroupSchema.index({ members: 1 });

// Groups saved before `locked` existed count as locked
const isLocked = (g) => g?.locked !== false;

const NotifyGroup =
  mongoose.models.ApprovalNotifyGroup ||
  mongoose.model("ApprovalNotifyGroup", notifyGroupSchema);

/*
 * People an employee removed from their OWN notified list, out of the ones HR
 * set through notify groups. Only allowed for groups that aren't locked.
 * Stored per (group, person): if HR later notifies that person through a
 * different group, it counts as a new decision and they show up again.
 * Locking a group clears its removals, so everyone gets those people again.
 */
const notifiedRemovalSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      unique: true,
    },
    removed: [
      {
        _id: false,
        group: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "ApprovalNotifyGroup",
          required: true,
        },
        notified: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Employee",
          required: true,
        },
      },
    ],
  },
  { timestamps: true },
);

const NotifiedRemoval =
  mongoose.models.ApprovalNotifiedRemoval ||
  mongoose.model("ApprovalNotifiedRemoval", notifiedRemovalSchema);

const NOTIFIED_SELECT = "firstName lastName position designation";

/** Notify groups each employee belongs to → Map<employeeId, group[]> */
async function notifyGroupsByEmployee(employeeIds, { populate = false } = {}) {
  const ids = list(employeeIds);
  const map = new Map(ids.map((id) => [id, []]));
  if (!ids.length) return map;
  let q = NotifyGroup.find({ members: { $in: ids } }).select(
    "name notifiedEmployees members locked",
  );
  if (populate)
    q = q.populate({ path: "notifiedEmployees", select: NOTIFIED_SELECT });
  const groups = await q.sort({ name: 1 }).lean();
  for (const g of groups) {
    for (const m of g.members || []) {
      const key = String(m);
      if (map.has(key)) map.get(key).push(g);
    }
  }
  return map;
}

/* ═══ helpers ════════════════════════════════════════════════════════ */

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function assertObjectId(id, label = "id") {
  if (!id || !mongoose.Types.ObjectId.isValid(id))
    throw httpError(`Invalid ${label}`);
}

/** ObjectId / populated doc / plain value → comparable string (or null). */
function str(v) {
  if (v === null || v === undefined) return null;
  if (
    v instanceof mongoose.Types.ObjectId ||
    v._bsontype === "ObjectId" ||
    v._bsontype === "ObjectID"
  ) {
    return v.toString();
  }
  if (typeof v === "object") return v._id !== undefined ? str(v._id) : null;
  return String(v).trim() || null;
}

/** Anything → unique list of non-empty strings. */
function list(v) {
  if (v === null || v === undefined || v === "") return [];
  return [...new Set((Array.isArray(v) ? v : [v]).map(str).filter(Boolean))];
}

const getPath = (obj, path) =>
  path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
const fullName = (e) => [e?.firstName, e?.lastName].filter(Boolean).join(" ");
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* ═══ scopes ═════════════════════════════════════════════════════════ */

let scopeCache = null;
function scopes() {
  if (!scopeCache) {
    scopeCache = SCOPE_CONFIG.flatMap((cfg) => {
      if (!cfg.field) return [cfg];
      const type = Employee.schema.path(cfg.field);
      if (!type) return []; // field not on Employee → scope disabled
      const inner =
        type.instance === "Array"
          ? type.embeddedSchemaType || type.caster
          : type;
      return [
        {
          ...cfg,
          ref: inner?.options?.ref,
          isObjectId: inner?.instance === "ObjectId",
        },
      ];
    });
  }
  return scopeCache;
}

function getScope(name) {
  const cfg = scopes().find((s) => s.scope === name);
  if (!cfg) {
    throw httpError(
      `Unknown scope "${name}". Use one of: ${scopes()
        .map((s) => s.scope)
        .join(", ")}.`,
    );
  }
  return cfg;
}

const valuesOf = (emp, cfg) =>
  cfg.field ? list(getPath(emp, cfg.field)) : [GLOBAL_VALUE];

function checkValues(cfg, values) {
  if (cfg.isObjectId)
    values.forEach((v) => assertObjectId(v, `${cfg.scope} id`));
}

/** Display labels: project names for ids, employee names, text as-is. */
async function labelsFor(cfg, values) {
  const labels = new Map(
    values.map((v) => [v, cfg.scope === "global" ? "Everyone" : v]),
  );
  const ids = values.filter((v) => mongoose.Types.ObjectId.isValid(v));
  if (!ids.length || !cfg.isObjectId) return labels;

  if (cfg.scope === "employee") {
    const emps = await Employee.find({ _id: { $in: ids } })
      .select("firstName lastName")
      .lean();
    emps.forEach((e) => labels.set(String(e._id), fullName(e)));
    return labels;
  }

  const Model =
    typeof cfg.ref === "string"
      ? mongoose.models[cfg.ref]
      : cfg.ref?.modelName
        ? cfg.ref
        : null;
  if (!Model) return labels;
  const fields = cfg.labelFields || ["name"];
  const docs = await Model.find({ _id: { $in: ids } })
    .select(fields.join(" "))
    .lean();
  docs.forEach((d) => {
    const label = fields.map((f) => d[f]).find(Boolean);
    if (label) labels.set(String(d._id), String(label));
  });
  return labels;
}

/**
 * Employee query from ids + filters + name search. Returns null when no
 * criteria were given (so bulk actions can refuse to hit everyone by accident).
 * filters = { designation: ["Engineer", "Foreman"], project: ["<id>"] }
 * OR within a field, AND across fields.
 */
function employeeQuery({ employeeIds, filters, search } = {}) {
  if (filters && typeof filters !== "object") {
    throw httpError("filters must be an object, e.g. { designation: [...] }.");
  }
  const and = [];

  const ids = list(employeeIds);
  if (ids.length) {
    ids.forEach((id) => assertObjectId(id, "employee id"));
    and.push({ _id: { $in: ids } });
  }

  for (const [name, raw] of Object.entries(filters || {})) {
    const values = list(raw);
    if (!values.length) continue;
    const cfg = getScope(name);
    if (!cfg.field || cfg.scope === "employee")
      throw httpError(`"${name}" can't be used as a filter.`);
    checkValues(cfg, values);
    and.push({ [cfg.field]: { $in: values } });
  }

  for (const term of String(search || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)) {
    const rx = new RegExp(escapeRegex(term), "i");
    and.push({ $or: [{ firstName: rx }, { lastName: rx }] });
  }

  return and.length ? { $and: and } : null;
}

/* ═══ resolution ═════════════════════════════════════════════════════ */

/**
 * Effective workflow for many employees at once.
 * @returns Map<employeeId, resolution>
 */
async function resolve(employeeIds, { detailed = false } = {}) {
  const ids = list(employeeIds);
  if (!ids.length) return new Map();

  const cfgs = scopes();
  const fields = new Set(["firstName", "lastName", "position"]);
  cfgs.forEach((s) => {
    if (s.field && s.field !== "_id") fields.add(s.field);
  });
  const employees = await Employee.find({ _id: { $in: ids } })
    .select([...fields].join(" "))
    .lean();
  if (!employees.length) return new Map();

  // personal = the employee's private CTO/Wellness route (newest wins)
  const personal = await ApprovalRoute.find({
    createdBy: { $in: ids },
    ...PERSONAL,
  })
    .select("_id createdBy")
    .sort({ updatedAt: -1 })
    .lean();
  const personalByEmp = new Map();
  personal.forEach((r) => {
    if (!personalByEmp.has(String(r.createdBy)))
      personalByEmp.set(String(r.createdBy), String(r._id));
  });

  // every assignment that could match one of these employees
  // (none when HR turned shared workflows off: personal workflows only)
  const { sharedWorkflowsEnabled } = await readSettings();
  const or = sharedWorkflowsEnabled
    ? cfgs
        .map((cfg) => ({
          scope: cfg.scope,
          value: {
            $in: [...new Set(employees.flatMap((e) => valuesOf(e, cfg)))],
          },
        }))
        .filter((c) => c.value.$in.length)
    : [];
  const assignments = or.length
    ? await Assignment.find({ $or: or }).sort({ updatedAt: -1 }).lean()
    : [];
  const assignmentByKey = new Map();
  assignments.forEach((a) => {
    const key = `${a.scope}:${a.value}`;
    if (!assignmentByKey.has(key)) assignmentByKey.set(key, a);
  });

  // load routes; a deleted route, or one moved out of CTO/Wellness, is skipped
  const routeIds = list([
    ...personalByEmp.values(),
    ...assignments.map((a) => a.route),
  ]);
  let q = ApprovalRoute.find({
    _id: { $in: routeIds },
    category: WORKFLOW_CATEGORY,
  });
  q = detailed ? q.populate(ROUTE_POPULATE) : q.select("name isPublic");
  const routes = new Map((await q.lean()).map((r) => [String(r._id), r]));

  const labels = new Map();
  if (detailed) {
    for (const cfg of cfgs) {
      const vals = [
        ...new Set(
          assignments.filter((a) => a.scope === cfg.scope).map((a) => a.value),
        ),
      ];
      labels.set(cfg.scope, await labelsFor(cfg, vals));
    }
  }

  // notify groups each employee is in (detailed: with the notified people's names)
  const groupsByEmp = await notifyGroupsByEmployee(ids, { populate: detailed });
  // "group:person" pairs each employee removed from their own list
  const removedByEmp = new Map(
    (await NotifiedRemoval.find({ employee: { $in: ids } }).lean()).map((r) => [
      String(r.employee),
      new Set((r.removed || []).map((p) => `${p.group}:${p.notified}`)),
    ]),
  );

  const out = new Map();
  for (const emp of employees) {
    let defaultWorkflow = null;
    let defaultMatchedBy = null;
    // What they'd get WITHOUT a direct (employee) assignment, i.e. from a
    // project / designation rule or the company default. Lets the UI warn
    // "removing them won't change anything, a rule still gives them this".
    let fallbackWorkflow = null;
    let fallbackMatchedBy = null;

    for (const cfg of cfgs) {
      const hit = valuesOf(emp, cfg)
        .map((v) => assignmentByKey.get(`${cfg.scope}:${v}`))
        .filter((a) => a && routes.has(String(a.route)))
        .sort((a, b) => b.updatedAt - a.updatedAt)[0];
      if (!hit) continue;

      const matchedBy = {
        scope: cfg.scope,
        value: hit.value,
        label: labels.get(cfg.scope)?.get(hit.value) ?? hit.value,
        assignmentId: hit._id,
      };
      if (!defaultWorkflow) {
        defaultWorkflow = routes.get(String(hit.route));
        defaultMatchedBy = matchedBy;
      }
      if (cfg.scope !== "employee") {
        fallbackWorkflow = routes.get(String(hit.route));
        fallbackMatchedBy = matchedBy;
        break;
      }
    }

    const personalWorkflow =
      routes.get(personalByEmp.get(String(emp._id))) || null;
    const groups = groupsByEmp.get(String(emp._id)) || [];

    // People HR set to be notified for this employee, from all their groups (no
    // duplicates). Anyone the employee removed is listed separately so they can
    // restore them.
    // A removal only counts for groups that aren't locked.
    const removedPairs = removedByEmp.get(String(emp._id)) || new Set();
    const byPerson = new Map();
    for (const g of groups) {
      for (const n of g.notifiedEmployees || []) {
        const nid = str(n);
        if (!nid || nid === String(emp._id)) continue;
        if (!byPerson.has(nid))
          byPerson.set(nid, { employee: n, groups: [], removedGroups: [] });
        const entry = byPerson.get(nid);
        const ref = { _id: g._id, name: g.name, locked: isLocked(g) };
        const removed = !ref.locked && removedPairs.has(`${g._id}:${nid}`);
        (removed ? entry.removedGroups : entry.groups).push(ref);
      }
    }
    const people = [...byPerson.values()];
    // locked = at least one of their groups is locked → the employee can't remove them
    const assignedNotifiedDetail = people
      .filter((p) => p.groups.length)
      .map(({ employee, groups: from }) => ({
        employee,
        groups: from,
        locked: from.some((g) => g.locked),
      }));
    const removedNotified = people
      .filter((p) => !p.groups.length)
      .map(({ employee, removedGroups }) => ({
        employee,
        groups: removedGroups,
      }));
    const assignedNotified = assignedNotifiedDetail.map((p) => p.employee);

    out.set(String(emp._id), {
      employee: emp,
      source: personalWorkflow
        ? "personal"
        : defaultWorkflow
          ? "assigned"
          : "none",
      hasPersonalWorkflow: Boolean(personalWorkflow),
      canResetToDefault: Boolean(personalWorkflow && defaultWorkflow), // enables the Default button
      workflow: personalWorkflow || defaultWorkflow, // what applies now
      defaultWorkflow, // what Default gives them
      defaultMatchedBy,
      fallbackWorkflow, // what Default would give them without a direct assignment
      fallbackMatchedBy,
      sharedWorkflowsEnabled, // false → HR uses personal workflows only
      notifyGroups: groups.map((g) => ({ _id: g._id, name: g.name })),
      // Notified people HR set through notify groups (ids, or populated employees in detailed mode)
      assignedNotified,
      assignedNotifiedDetail, // [{ employee, groups: [{ _id, name, locked }], locked }]
      removedNotified, // HR-set people this employee removed: [{ employee, groups }]
    });
  }
  return out;
}

/* ═══ effective workflow + reset ═════════════════════════════════════ */

async function getEffectiveWorkflowService({ employeeId }) {
  assertObjectId(employeeId, "employee id");
  const result = (await resolve([employeeId], { detailed: true })).get(
    String(employeeId),
  );
  if (!result) throw httpError("Employee not found.", 404);
  return result;
}

/** The "Default" button. */
async function resetToDefaultService({ employeeId, force = false }) {
  const before = await getEffectiveWorkflowService({ employeeId });
  if (!before.hasPersonalWorkflow) return { changed: false, ...before };

  if (!before.sharedWorkflowsEnabled) {
    throw httpError(
      "Shared workflows are turned off, so there's no default workflow to go back to. Each employee uses their own workflow.",
      409,
    );
  }
  if (!before.defaultWorkflow && !force) {
    throw httpError(
      "No default workflow is assigned to this employee yet, so resetting would leave them with no approvers. Ask an admin to assign one first.",
      409,
    );
  }

  await ApprovalRoute.deleteMany({ createdBy: employeeId, ...PERSONAL });
  return {
    changed: true,
    ...(await getEffectiveWorkflowService({ employeeId })),
  };
}

/**
 * For your application service: who approves this employee's CTO/Wellness request.
 * `approvers` has the same { approver, role } shape as resolveApproversFromRoute.
 * Steps where the applicant is the approver are skipped (e.g. a PM filing
 * under their own project's workflow).
 */
async function resolveApproversForEmployee(
  employeeId,
  { excludeSelf = true } = {},
) {
  const {
    workflow: route,
    source,
    assignedNotified,
    sharedWorkflowsEnabled,
  } = await getEffectiveWorkflowService({ employeeId });
  if (!route) {
    throw httpError(
      sharedWorkflowsEnabled
        ? "No approval workflow is set up for this employee. Ask an admin to assign one."
        : "This employee hasn't set up their own approval workflow yet (shared workflows are turned off).",
      422,
    );
  }

  const self = String(employeeId);
  const approvers = [];
  let skippedSelf = false;
  for (const step of [...(route.steps || [])].sort(
    (a, b) => a.level - b.level,
  )) {
    if (step.isEnabled === false) continue;
    const approverId = str(step.approver);
    if (!approverId) {
      throw httpError(
        `Step ${step.level} of "${route.name}" points to an employee who no longer exists.`,
        422,
      );
    }
    if (excludeSelf && approverId === self) {
      skippedSelf = true;
      continue;
    }
    approvers.push({ approver: approverId, role: step.role || "" });
  }

  if (!approvers.length) {
    throw httpError(
      `"${route.name}" has no approvers left for this employee (they can't approve their own request).`,
      422,
    );
  }

  // Notified = the workflow's own list (an employee's personal workflow can have
  // one) + everyone from their notify groups. Approvers and the applicant are
  // left out, and nobody appears twice.
  const approverIds = new Set(approvers.map((a) => a.approver));
  const notifiedEmployees = [
    ...new Set(
      [...(route.notifiedEmployees || []), ...(assignedNotified || [])].map(
        str,
      ),
    ),
  ].filter((nid) => nid && nid !== self && !approverIds.has(nid));

  return {
    routeId: String(route._id),
    routeName: route.name,
    source,
    approvers,
    notifiedEmployees,
    skippedSelf,
  };
}

/* ═══ employee: my notified list ═════════════════════════════════════ */
// What the employee sees as ONE list: people HR set (notify groups) + their
// workflow's own notified people. These keep the two from doubling up.

const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

/**
 * Remove anyone HR already notifies for this employee from a list they're
 * saving (e.g. their personal workflow's notified people), so nobody is in
 * the list twice. Non-array input is returned as-is.
 */
async function stripAssignedNotified({ employeeId, ids }) {
  if (!Array.isArray(ids)) return ids;
  const { assignedNotified } = await getEffectiveWorkflowService({
    employeeId,
  });
  const assigned = new Set((assignedNotified || []).map(str));
  return list(ids).filter((id) => !assigned.has(id));
}

/**
 * Save the notified people on the employee's personal workflow.
 * - People HR already notifies for them are skipped (no duplicates).
 * - Someone they removed earlier from HR's list is restored instead.
 * - Approvers and the employee themself are skipped.
 * Needs a personal workflow: on the default there's nothing of theirs to save to.
 */
async function updateMyNotifiedService({ employeeId, notifiedEmployees }) {
  assertObjectId(employeeId, "employee id");
  if (!Array.isArray(notifiedEmployees))
    throw httpError("notifiedEmployees must be an array.");

  const route = await ApprovalRoute.findOne({
    createdBy: employeeId,
    ...PERSONAL,
  }).sort({ updatedAt: -1 });
  if (!route) {
    throw httpError(
      "You're using the default workflow. Click Customize to make your own copy first, then add people to notify.",
      409,
    );
  }

  const requested = await existingEmployeeIds(
    notifiedEmployees,
    "notified employee",
  );
  const me = await getEffectiveWorkflowService({ employeeId });
  const assigned = new Set((me.assignedNotified || []).map(str));
  const removed = new Set(
    (me.removedNotified || []).map((p) => str(p.employee)),
  );
  const approvers = new Set((route.steps || []).map((s) => str(s.approver)));
  const self = String(employeeId);

  const restore = requested.filter((id) => removed.has(id));
  const keep = requested.filter(
    (id) =>
      id !== self &&
      !approvers.has(id) &&
      !assigned.has(id) &&
      !removed.has(id),
  );

  await ApprovalRoute.updateOne(
    { _id: route._id },
    { $set: { notifiedEmployees: keep.map(toObjectId) } },
  );
  if (restore.length) await restoreAssignedNotified(employeeId, restore);

  return {
    saved: keep.length,
    restored: restore.length,
    skipped: requested.length - keep.length - restore.length,
    ...(await getEffectiveWorkflowService({ employeeId })),
  };
}

async function restoreAssignedNotified(employeeId, ids) {
  const doc = await NotifiedRemoval.findOne({ employee: employeeId });
  if (!doc) return;
  const drop = new Set(ids.map(String));
  doc.removed = doc.removed.filter((p) => !drop.has(String(p.notified)));
  await doc.save();
}

/**
 * Remove people HR set (through notify groups) from the employee's OWN
 * requests. Only people from groups that aren't locked; the group itself is
 * not changed.
 */
async function removeAssignedNotifiedService({ employeeId, ids }) {
  assertObjectId(employeeId, "employee id");
  const requested = list(ids);
  requested.forEach((id) => assertObjectId(id, "employee id"));
  if (!requested.length)
    throw httpError("Choose at least one person to remove.");

  const me = await getEffectiveWorkflowService({ employeeId });
  const detail = new Map(
    (me.assignedNotifiedDetail || []).map((p) => [str(p.employee), p]),
  );
  const fromGroups = new Map([...detail].map(([id, p]) => [id, p.groups]));
  const alreadyRemoved = new Set(
    (me.removedNotified || []).map((p) => str(p.employee)),
  );
  const notHrSet = requested.filter(
    (id) => !fromGroups.has(id) && !alreadyRemoved.has(id),
  );
  if (notHrSet.length)
    throw httpError(
      "You can only remove people HR set to be notified for you.",
      400,
    );
  const locked = requested.filter((id) => detail.get(id)?.locked);
  if (locked.length) {
    const names = locked
      .map((id) => fullName(detail.get(id).employee) || "This person")
      .join(", ");
    throw httpError(
      `${names} ${locked.length === 1 ? "is" : "are"} required by HR and can't be removed.`,
      403,
    );
  }

  const pairs = requested.flatMap((id) =>
    (fromGroups.get(id) || []).map((g) => ({
      group: toObjectId(str(g._id)),
      notified: toObjectId(id),
    })),
  );
  if (pairs.length) {
    const doc =
      (await NotifiedRemoval.findOne({ employee: employeeId })) ||
      new NotifiedRemoval({ employee: employeeId, removed: [] });
    const have = new Set(doc.removed.map((p) => `${p.group}:${p.notified}`));
    pairs.forEach(
      (p) => have.has(`${p.group}:${p.notified}`) || doc.removed.push(p),
    );
    await doc.save();
  }
  return {
    removed: requested.length,
    ...(await getEffectiveWorkflowService({ employeeId })),
  };
}

/** Put HR-set people the employee removed back on their list. */
async function restoreAssignedNotifiedService({ employeeId, ids }) {
  assertObjectId(employeeId, "employee id");
  const requested = list(ids);
  requested.forEach((id) => assertObjectId(id, "employee id"));
  if (!requested.length)
    throw httpError("Choose at least one person to restore.");
  await restoreAssignedNotified(employeeId, requested);
  return {
    restored: requested.length,
    ...(await getEffectiveWorkflowService({ employeeId })),
  };
}

/* ═══ admin: employees ═══════════════════════════════════════════════ */

async function listEmployeesService({
  employeeIds,
  filters,
  search,
  page = 1,
  limit = 25,
} = {}) {
  const query = employeeQuery({ employeeIds, filters, search }) || {};
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(limit, 10) || 25),
  );

  const [total, employees] = await Promise.all([
    Employee.countDocuments(query),
    Employee.find(query)
      .select("_id")
      .sort({ lastName: 1, firstName: 1, _id: 1 })
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize)
      .lean(),
  ]);

  const ids = employees.map((e) => String(e._id));
  const resolved = await resolve(ids);
  return {
    items: ids.map((id) => resolved.get(id)).filter(Boolean),
    page: pageNum,
    limit: pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };
}

/* ═══ admin: assignments ═════════════════════════════════════════════ */

async function findTemplate(routeId) {
  assertObjectId(routeId, "routeId");
  const [route, registered] = await Promise.all([
    ApprovalRoute.findById(routeId).select("name category isPublic").lean(),
    WorkflowTemplate.exists({ route: routeId }),
  ]);
  if (!route || !registered) {
    throw httpError(
      "Shared workflow not found. Only workflows created under /templates can be assigned.",
      404,
    );
  }
  if (route.category !== WORKFLOW_CATEGORY) {
    throw httpError(`Only ${WORKFLOW_CATEGORY} workflows can be assigned.`);
  }
  return route;
}

async function upsertAssignment(filter, set) {
  const options = {
    new: true,
    upsert: true,
    runValidators: true,
    setDefaultsOnInsert: true,
  };
  try {
    return await Assignment.findOneAndUpdate(
      filter,
      { $set: set },
      options,
    ).lean();
  } catch (err) {
    if (err?.code === 11000)
      return Assignment.findOneAndUpdate(
        filter,
        { $set: set },
        { new: true },
      ).lean();
    throw err;
  }
}

/**
 * A rule: "designation X / project P / everyone uses route R".
 * Replaces whatever was assigned to that target before. Rules are live:
 * new employees with that designation pick it up automatically.
 */
async function setAssignmentService({ scope, value, routeId, assignedBy }) {
  const cfg = getScope(scope);
  let normalized = GLOBAL_VALUE;
  if (cfg.field) {
    normalized = str(value);
    if (!normalized) throw httpError(`value is required for scope "${scope}".`);
    checkValues(cfg, [normalized]);
    if (
      cfg.scope === "employee" &&
      !(await Employee.exists({ _id: normalized }))
    ) {
      throw httpError("Employee not found.", 404);
    }
  }

  const route = await findTemplate(routeId);
  const assignment = await upsertAssignment(
    { scope: cfg.scope, value: normalized },
    { route: route._id, ...(assignedBy ? { assignedBy } : {}) },
  );

  const [labels, employeeCount] = await Promise.all([
    labelsFor(cfg, [normalized]),
    cfg.field
      ? Employee.countDocuments({ [cfg.field]: normalized })
      : Employee.estimatedDocumentCount(),
  ]);

  // employeeCount 0 usually means a typo in a text designation: worth a warning in the UI
  return { ...assignment, route, label: labels.get(normalized), employeeCount };
}

/**
 * Assign a route to specific employees, picked by id and/or filters.
 * Snapshot: only employees who match right now. Use a designation/project
 * rule if new hires should get it too.
 * resetPersonal: also delete their private route so the assigned one
 * applies now. Without it, they keep their own workflow.
 */
async function assignToEmployeesService({
  routeId,
  employeeIds,
  filters,
  resetPersonal = false,
  assignedBy,
}) {
  const route = await findTemplate(routeId);
  const ids = list(employeeIds);
  const query = employeeQuery({ employeeIds: ids, filters });
  if (!query) {
    throw httpError(
      'Send employeeIds and/or filters. To cover everyone, assign with scope "global".',
    );
  }

  const matched = (await Employee.find(query).select("_id").lean()).map((e) =>
    String(e._id),
  );
  const usedFilters = Object.values(filters || {}).some((v) => list(v).length);
  if (ids.length && !usedFilters && matched.length !== ids.length) {
    const found = new Set(matched);
    throw httpError(
      `Employee(s) not found: ${ids.filter((id) => !found.has(id)).join(", ")}`,
      404,
    );
  }

  if (matched.length) {
    await Assignment.bulkWrite(
      matched.map((id) => ({
        updateOne: {
          filter: { scope: "employee", value: id },
          update: {
            $set: { route: route._id, ...(assignedBy ? { assignedBy } : {}) },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }

  const withPersonal = matched.length
    ? await ApprovalRoute.distinct("createdBy", {
        createdBy: { $in: matched },
        ...PERSONAL,
      })
    : [];
  if (resetPersonal && withPersonal.length) {
    await ApprovalRoute.deleteMany({
      createdBy: { $in: withPersonal },
      ...PERSONAL,
    });
  }

  return {
    route,
    assigned: matched.length,
    personalWorkflowsReset: resetPersonal ? withPersonal.length : 0,
    keepingPersonalWorkflow: resetPersonal ? 0 : withPersonal.length,
  };
}

async function listAssignmentsService({ scope, routeId } = {}) {
  const filter = {};
  if (scope) filter.scope = getScope(scope).scope;
  if (routeId) {
    assertObjectId(routeId, "routeId");
    filter.route = routeId;
  }

  const rows = await Assignment.find(filter)
    .populate({ path: "route", select: "name category isPublic" })
    .populate({ path: "assignedBy", select: "firstName lastName" })
    .sort({ updatedAt: -1 })
    .lean();

  // clean up assignments whose route was deleted
  const dangling = rows.filter((a) => !a.route).map((a) => a._id);
  if (dangling.length) await Assignment.deleteMany({ _id: { $in: dangling } });
  const live = rows.filter((a) => a.route);

  const labels = new Map();
  for (const cfg of scopes()) {
    labels.set(
      cfg.scope,
      await labelsFor(cfg, [
        ...new Set(
          live.filter((a) => a.scope === cfg.scope).map((a) => a.value),
        ),
      ]),
    );
  }
  const order = scopes().map((s) => s.scope);
  return live
    .map((a) => ({ ...a, label: labels.get(a.scope)?.get(a.value) ?? a.value }))
    .sort((a, b) => order.indexOf(a.scope) - order.indexOf(b.scope));
}

async function removeAssignmentService({ id }) {
  assertObjectId(id, "assignment id");
  const deleted = await Assignment.findByIdAndDelete(id).lean();
  if (!deleted) throw httpError("Assignment not found.", 404);
  return { deleted: true, id: String(deleted._id) };
}

/** Bulk remove by assignment ids and/or direct employee assignments. */
async function removeAssignmentsService({ assignmentIds, employeeIds }) {
  const aIds = list(assignmentIds);
  const eIds = list(employeeIds);
  aIds.forEach((id) => assertObjectId(id, "assignment id"));
  eIds.forEach((id) => assertObjectId(id, "employee id"));
  if (!aIds.length && !eIds.length)
    throw httpError("Send assignmentIds and/or employeeIds.");

  const or = [];
  if (aIds.length) or.push({ _id: { $in: aIds } });
  if (eIds.length) or.push({ scope: "employee", value: { $in: eIds } });
  const { deletedCount } = await Assignment.deleteMany({ $or: or });
  return { deleted: deletedCount };
}

/**
 * Every designation (or project) with its employee count and the route
 * assigned to it. This is the data for the "designation → workflow" table.
 */
async function getScopeValuesService({ scope }) {
  const cfg = getScope(scope);
  if (!cfg.field || cfg.scope === "employee")
    throw httpError(`"${scope}" has no value list.`);

  const path = `$${cfg.field}`;
  const [rows, assignments] = await Promise.all([
    Employee.aggregate([
      { $match: { [cfg.field]: { $exists: true, $nin: [null, ""] } } },
      { $unwind: path },
      { $match: { [cfg.field]: { $nin: [null, ""] } } },
      { $group: { _id: path, employeeCount: { $sum: 1 } } },
    ]),
    Assignment.find({ scope: cfg.scope })
      .populate({ path: "route", select: "name category" })
      .lean(),
  ]);

  const byValue = new Map();
  const entry = (value) => {
    if (!byValue.has(value))
      byValue.set(value, { value, employeeCount: 0, assignment: null });
    return byValue.get(value);
  };
  rows.forEach((r) => {
    const v = str(r._id);
    if (v) entry(v).employeeCount = r.employeeCount;
  });
  assignments
    .filter((a) => a.route && a.route.category === WORKFLOW_CATEGORY)
    .forEach((a) => {
      entry(a.value).assignment = {
        _id: a._id,
        route: { _id: a.route._id, name: a.route.name },
      };
    });

  const labels = await labelsFor(cfg, [...byValue.keys()]);
  return [...byValue.values()]
    .map((e) => ({ ...e, label: labels.get(e.value) ?? e.value }))
    .sort((a, b) => String(a.label).localeCompare(String(b.label)));
}

/* ═══ shared workflows (templates) ═══════════════════════════════════ */

/** True if this route is a shared workflow (used to block the generic PATCH/DELETE /:id). */
async function isTemplateRoute(routeId) {
  if (!mongoose.Types.ObjectId.isValid(routeId)) return false;
  return Boolean(await WorkflowTemplate.exists({ route: routeId }));
}

async function assertTemplate(id) {
  assertObjectId(id, "workflow id");
  if (!(await WorkflowTemplate.exists({ route: id }))) {
    throw httpError("Shared workflow not found.", 404);
  }
}

async function listTemplatesService() {
  const entries = await WorkflowTemplate.find().lean();
  const routes = await ApprovalRoute.find({
    _id: { $in: entries.map((e) => e.route) },
  })
    .populate(ROUTE_POPULATE)
    .sort({ createdAt: -1 })
    .lean();

  // drop registry entries whose route was deleted some other way
  const alive = new Set(routes.map((r) => String(r._id)));
  const dead = entries
    .filter((e) => !alive.has(String(e.route)))
    .map((e) => e._id);
  if (dead.length) await WorkflowTemplate.deleteMany({ _id: { $in: dead } });

  const counts = await Assignment.aggregate([
    { $match: { route: { $in: routes.map((r) => r._id) } } },
    {
      $group: { _id: { route: "$route", scope: "$scope" }, count: { $sum: 1 } },
    },
  ]);
  const byRoute = new Map();
  counts.forEach(({ _id, count }) => {
    const key = String(_id.route);
    if (!byRoute.has(key)) byRoute.set(key, {});
    byRoute.get(key)[_id.scope] = count;
  });

  return routes.map((r) => {
    const assignmentCounts = byRoute.get(String(r._id)) || {};
    return {
      ...r,
      assignmentCounts,
      isCompanyDefault: Boolean(assignmentCounts.global),
    };
  });
}

/**
 * Create a shared workflow. Uses your existing create service (same
 * validation), always public and CTO/Wellness, then registers it.
 */
async function createTemplateService({ data, createdBy }) {
  const route = await createApprovalRouteService({
    data: { ...(data || {}), isPublic: true, category: WORKFLOW_CATEGORY },
    createdBy,
  });
  try {
    await WorkflowTemplate.create({ route: route._id, createdBy });
  } catch (err) {
    await ApprovalRoute.deleteOne({ _id: route._id }); // don't leave a half-created workflow
    throw err;
  }
  return route;
}

/** Edit a shared workflow. Changes apply right away to everyone assigned to it. */
async function updateTemplateService({ id, data, requesterId }) {
  await assertTemplate(id);
  return updateApprovalRouteService({
    id,
    data: { ...(data || {}), isPublic: true, category: WORKFLOW_CATEGORY },
    requesterId,
    isAdmin: true, // the route permission already checked who can do this
  });
}

/** Delete a shared workflow. 409 while it's assigned, unless force=true. */
async function deleteTemplateService({ id, force = false }) {
  await assertTemplate(id);
  const assigned = await Assignment.countDocuments({ route: id });
  if (assigned && !force) {
    throw httpError(
      `This workflow is assigned ${assigned} time(s). Remove the assignments first, or delete with ?force=true. Those employees will fall back to their next matching workflow.`,
      409,
    );
  }
  const { deletedCount } = await Assignment.deleteMany({ route: id });
  await WorkflowTemplate.deleteOne({ route: id });
  await ApprovalRoute.deleteOne({ _id: id });
  return { deleted: true, id: String(id), assignmentsRemoved: deletedCount };
}

/* ═══ notify groups (admin) ══════════════════════════════════════════ */

async function existingEmployeeIds(ids, label) {
  const unique = list(ids);
  unique.forEach((id) => assertObjectId(id, label));
  if (!unique.length) return [];
  const found = await Employee.countDocuments({ _id: { $in: unique } });
  if (found !== unique.length)
    throw httpError(`One or more ${label}s not found.`, 404);
  return unique;
}

async function findNotifyGroup(id) {
  assertObjectId(id, "notify group id");
  const group = await NotifyGroup.findById(id);
  if (!group) throw httpError("Notify group not found.", 404);
  return group;
}

const populatedNotifyGroup = (id) =>
  NotifyGroup.findById(id)
    .populate({ path: "notifiedEmployees", select: NOTIFIED_SELECT })
    .lean();

const withMemberCount = ({ members, ...g }) => ({
  ...g,
  locked: isLocked(g),
  memberCount: (members || []).length,
});

/** Forget every employee's removals for this group (when it's locked or deleted). */
async function clearRemovalsForGroup(groupId) {
  const key = String(groupId);
  const docs = await NotifiedRemoval.find({ "removed.group": groupId });
  for (const doc of docs) {
    doc.removed = doc.removed.filter((p) => String(p.group) !== key);
    await doc.save();
  }
}

async function listNotifyGroupsService() {
  const groups = await NotifyGroup.find()
    .populate({ path: "notifiedEmployees", select: NOTIFIED_SELECT })
    .sort({ name: 1 })
    .lean();
  return groups.map(withMemberCount);
}

async function getNotifyGroupService({ id }) {
  await findNotifyGroup(id);
  return withMemberCount(await populatedNotifyGroup(id));
}

async function createNotifyGroupService({ data, createdBy }) {
  const { name, description, notifiedEmployees, locked } = data || {};
  if (!name || !String(name).trim()) throw httpError("Group name is required.");
  const notified = await existingEmployeeIds(
    notifiedEmployees,
    "notified employee",
  );
  if (!notified.length) throw httpError("Add at least one person to notify.");
  const group = await NotifyGroup.create({
    name: String(name).trim(),
    description: description ? String(description).trim() : "",
    notifiedEmployees: notified,
    members: [],
    locked: locked === undefined ? true : Boolean(locked),
    ...(createdBy && mongoose.Types.ObjectId.isValid(createdBy)
      ? { createdBy }
      : {}),
  });
  return withMemberCount(await populatedNotifyGroup(group._id));
}

async function updateNotifyGroupService({ id, data }) {
  const group = await findNotifyGroup(id);
  const { name, description, notifiedEmployees, locked } = data || {};
  const wasLocked = isLocked(group);
  if (name !== undefined) {
    if (!String(name).trim()) throw httpError("Group name cannot be empty.");
    group.name = String(name).trim();
  }
  if (description !== undefined)
    group.description = String(description || "").trim();
  if (notifiedEmployees !== undefined) {
    const notified = await existingEmployeeIds(
      notifiedEmployees,
      "notified employee",
    );
    if (!notified.length) throw httpError("Add at least one person to notify.");
    group.notifiedEmployees = notified;
  }
  if (locked !== undefined) group.locked = Boolean(locked);
  await group.save();
  // Locked again → people employees had removed come back for everyone
  if (!wasLocked && isLocked(group)) await clearRemovalsForGroup(group._id);
  return withMemberCount(await populatedNotifyGroup(group._id));
}

async function deleteNotifyGroupService({ id }) {
  const group = await findNotifyGroup(id);
  await NotifyGroup.deleteOne({ _id: group._id });
  await clearRemovalsForGroup(group._id);
  return {
    deleted: true,
    id: String(group._id),
    membersRemoved: group.members.length,
  };
}

/** Employees in the group → [{ _id, label }] */
async function getNotifyGroupMembersService({ id }) {
  const group = await findNotifyGroup(id);
  const emps = await Employee.find({ _id: { $in: group.members } })
    .select("firstName lastName")
    .lean();
  return emps
    .map((e) => ({ _id: String(e._id), label: fullName(e) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Add and/or remove employees: { add: [ids], remove: [ids] } */
async function updateNotifyGroupMembersService({ id, add, remove }) {
  const group = await findNotifyGroup(id);
  const toAdd = await existingEmployeeIds(add, "employee");
  const toRemove = list(remove);
  toRemove.forEach((rid) => assertObjectId(rid, "employee id"));

  const before = new Set(group.members.map(String));
  const update = {};
  if (toAdd.length) update.$addToSet = { members: { $each: toAdd } };
  if (Object.keys(update).length)
    await NotifyGroup.updateOne({ _id: group._id }, update);
  if (toRemove.length) {
    await NotifyGroup.updateOne(
      { _id: group._id },
      {
        $pullAll: {
          members: toRemove.map((rid) => new mongoose.Types.ObjectId(rid)),
        },
      },
    );
  }

  const after = await NotifyGroup.findById(group._id).select("members").lean();
  return {
    added: toAdd.filter((a) => !before.has(a)).length,
    removed: toRemove.filter((r) => before.has(r)).length,
    memberCount: after.members.length,
  };
}

/* ═══ settings (admin) ═══════════════════════════════════════════════ */

/**
 * → { sharedWorkflowsEnabled, updatedAt, updatedBy,
 *     employeeCount, withPersonalWorkflow, withoutPersonalWorkflow }
 * The counts tell HR how many people would have no workflow if shared
 * workflows were off.
 */
async function getWorkflowSettingsService() {
  const settings = await readSettings();
  const creators = (await ApprovalRoute.distinct("createdBy", PERSONAL)).filter(
    Boolean,
  );
  const [employeeCount, withPersonalWorkflow] = await Promise.all([
    Employee.countDocuments({}),
    creators.length ? Employee.countDocuments({ _id: { $in: creators } }) : 0,
  ]);
  return {
    ...settings,
    employeeCount,
    withPersonalWorkflow,
    withoutPersonalWorkflow: Math.max(0, employeeCount - withPersonalWorkflow),
  };
}

/** { sharedWorkflowsEnabled: boolean } */
async function updateWorkflowSettingsService({ data, updatedBy }) {
  const { sharedWorkflowsEnabled } = data || {};
  if (typeof sharedWorkflowsEnabled !== "boolean") {
    throw httpError("sharedWorkflowsEnabled must be true or false.");
  }
  const doc =
    (await WorkflowSettings.findOne({ key: WORKFLOW_CATEGORY })) ||
    new WorkflowSettings({ key: WORKFLOW_CATEGORY });
  doc.sharedWorkflowsEnabled = sharedWorkflowsEnabled;
  if (updatedBy && mongoose.Types.ObjectId.isValid(updatedBy))
    doc.updatedBy = updatedBy;
  await doc.save();
  return getWorkflowSettingsService();
}

module.exports = {
  // settings
  getWorkflowSettingsService,
  updateWorkflowSettingsService,
  // employee
  getEffectiveWorkflowService,
  resetToDefaultService,
  stripAssignedNotified,
  updateMyNotifiedService,
  removeAssignedNotifiedService,
  restoreAssignedNotifiedService,
  // notify groups
  listNotifyGroupsService,
  getNotifyGroupService,
  createNotifyGroupService,
  updateNotifyGroupService,
  deleteNotifyGroupService,
  getNotifyGroupMembersService,
  updateNotifyGroupMembersService,
  // shared workflows
  isTemplateRoute,
  listTemplatesService,
  createTemplateService,
  updateTemplateService,
  deleteTemplateService,
  // admin
  listEmployeesService,
  getScopeValuesService,
  listAssignmentsService,
  setAssignmentService,
  assignToEmployeesService,
  removeAssignmentService,
  removeAssignmentsService,
  // application service
  resolveApproversForEmployee,
};
