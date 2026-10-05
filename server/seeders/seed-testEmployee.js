require("../config/loadEnv");
const mongoose = require("mongoose");

const Employee = require("../models/employeeModel");
const Designation = require("../models/designationModel");
const Role = require("../models/roleModel");
const Project = require("../models/projectModel");

/* ------------------------------------------------------------------
   TEST ACCOUNTS
   - All use @example.com (reserved test domain, no real inbox)
   - All use lastName "TESTER" and employeeId "TEST-###"
   - Remove them anytime with:  --clean

   Suggested approval route for testing (Cagayan):
     Step 1: test.supervisor1  (Provincial Officer)
     Step 2: test.supervisor2  (TOD Chief)
     Step 3: test.supervisor3  (Regional Director)
   Applicants: test.regular (Organic) and test.jo (JO)
------------------------------------------------------------------- */

const TEST_EMAIL_DOMAIN = "example.com";
const TEST_ID_PREFIX = "TEST";
const TEST_PASSWORD = "Test@2026!";
const ORGANIC_PROJECT_NAME = "N/A";

const testEmployeesData = [
  // --- ADMIN ---
  {
    lastName: "TESTER",
    firstName: "ALPHA",
    middleName: "ADMIN",
    position: "ISA II",
    email: `test.admin@${TEST_EMAIL_DOMAIN}`,
    employeeType: "Organic",
    projectName: ORGANIC_PROJECT_NAME,
    office: "Regional Office, Technical Operations Division",
    designationName: "Regional Office",
    roleName: "admin",
  },

  // --- SUPERVISORS (approvers) ---
  {
    lastName: "TESTER",
    firstName: "BRAVO",
    middleName: "SUPERVISOR",
    position: "ITO II (Provincial Officer)",
    email: `test.supervisor1@${TEST_EMAIL_DOMAIN}`,
    employeeType: "Organic",
    projectName: ORGANIC_PROJECT_NAME,
    office: "Cagayan Provincial Office",
    designationName: "Cagayan Provincial Office",
    roleName: "supervisor",
  },
  {
    lastName: "TESTER",
    firstName: "CHARLIE",
    middleName: "SUPERVISOR",
    position: "ITO III (TOD Chief)",
    email: `test.supervisor2@${TEST_EMAIL_DOMAIN}`,
    employeeType: "Organic",
    projectName: ORGANIC_PROJECT_NAME,
    office: "Regional Office, Technical Operations Division",
    designationName: "Regional Office",
    roleName: "supervisor",
  },
  {
    lastName: "TESTER",
    firstName: "DELTA",
    middleName: "SUPERVISOR",
    position: "Director IV (Regional Director)",
    email: `test.supervisor3@${TEST_EMAIL_DOMAIN}`,
    employeeType: "Organic",
    projectName: ORGANIC_PROJECT_NAME,
    office: "Regional Office, Office of the Regional Director",
    designationName: "Regional Office",
    roleName: "supervisor",
  },

  // --- REGULAR (Organic applicant) ---
  {
    lastName: "TESTER",
    firstName: "ECHO",
    middleName: "REGULAR",
    position: "CEO II",
    email: `test.regular@${TEST_EMAIL_DOMAIN}`,
    employeeType: "Organic",
    projectName: ORGANIC_PROJECT_NAME,
    office: "Cagayan Provincial Office",
    designationName: "Cagayan Provincial Office",
    roleName: "regular",
  },

  // --- JO (Job Order applicant) ---
  {
    lastName: "TESTER",
    firstName: "FOXTROT",
    middleName: "JOBORDER",
    position: "PDO I",
    email: `test.jo@${TEST_EMAIL_DOMAIN}`,
    employeeType: "JO",
    projectName: "DigiGov",
    office: "Cagayan Provincial Office",
    designationName: "Cagayan Provincial Office",
    roleName: "jo",
  },

  // --- HR ---
  {
    lastName: "TESTER",
    firstName: "GOLF",
    middleName: "HUMANRESOURCE",
    position: "HRMO II",
    email: `test.hr@${TEST_EMAIL_DOMAIN}`,
    employeeType: "Organic",
    projectName: ORGANIC_PROJECT_NAME,
    office: "Regional Office, Administrative and Finance Division",
    designationName: "Regional Office",
    roleName: "hr",
  },
];

const getDivision = (officeString = "") => {
  const lowerOffice = officeString.toLowerCase();
  if (lowerOffice.includes("administrative and finance")) return "AFD";
  if (lowerOffice.includes("regional director")) return "ORD";
  return "TOD";
};

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const findRole = (name) =>
  Role.findOne({ name: { $regex: new RegExp(`^${escapeRegex(name)}$`, "i") } });

const testEmailRegex = new RegExp(`@${escapeRegex(TEST_EMAIL_DOMAIN)}$`, "i");
const testIdRegex = new RegExp(`^${escapeRegex(TEST_ID_PREFIX)}-\\d+$`);

// Finds the next free TEST-### id so it never collides with existing records
const makeIdGenerator = async () => {
  const existing = await Employee.find(
    { employeeId: { $regex: testIdRegex } },
    { employeeId: 1 },
  ).lean();

  const used = new Set(existing.map((e) => e.employeeId));
  let n = 1;

  return () => {
    while (used.has(`${TEST_ID_PREFIX}-${String(n).padStart(3, "0")}`)) n++;
    const id = `${TEST_ID_PREFIX}-${String(n).padStart(3, "0")}`;
    used.add(id);
    return id;
  };
};

/* ------------------ CLEAN MODE ------------------ */
const cleanTestEmployees = async () => {
  const filter = {
    email: { $regex: testEmailRegex },
    employeeId: { $regex: testIdRegex },
  };

  const toDelete = await Employee.find(filter, { email: 1 }).lean();
  if (toDelete.length === 0) {
    console.log("ℹ️  No test accounts found. Nothing to delete.");
    return;
  }

  toDelete.forEach((e) => console.log(`  🗑️  Deleting: ${e.email}`));
  const result = await Employee.deleteMany(filter);
  console.log(`\n✅ Deleted ${result.deletedCount} test account(s).`);
};

/* ------------------ SEED MODE ------------------ */
const seedTestEmployees = async () => {
  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  // 1. Roles (cached)
  const roleCache = new Map();
  for (const roleName of [
    ...new Set(testEmployeesData.map((d) => d.roleName)),
  ]) {
    const role = await findRole(roleName);
    if (!role) {
      const available = await Role.find({}, { name: 1 }).lean();
      throw new Error(
        `Role "${roleName}" not found. Roles in this database: [${
          available.map((r) => r.name).join(", ") || "none"
        }]. Run your Role seeder first.`,
      );
    }
    roleCache.set(roleName, role);
  }

  // 2. Designations
  const designations = await Designation.find({}).lean();
  if (designations.length === 0) {
    throw new Error(
      "No designations found in this database. Run seed-designation.js first.",
    );
  }
  const designationMap = designations.reduce((acc, des) => {
    acc[des.name] = des._id;
    return acc;
  }, {});

  const nextEmployeeId = await makeIdGenerator();
  const projectCache = new Map();

  // 3. Test employees (one failure does not stop the rest)
  for (const data of testEmployeesData) {
    try {
      const email = data.email.trim().toLowerCase();

      const exists = await Employee.exists({ email });
      if (exists) {
        skipped++;
        console.log(`  ⏩ Skipped: ${email} (already exists)`);
        continue;
      }

      // Project (cached so each is looked up once)
      const projectKey = data.projectName.toLowerCase();
      let projectRecord = projectCache.get(projectKey);
      if (!projectRecord) {
        projectRecord = await Project.findOne({
          name: {
            $regex: new RegExp(`^${escapeRegex(data.projectName)}$`, "i"),
          },
        });
        if (!projectRecord) {
          projectRecord = await Project.create({
            name: data.projectName,
            status: "Active",
          });
          console.log(`  📌 Created project: ${data.projectName}`);
        }
        projectCache.set(projectKey, projectRecord);
      }

      const designationId = designationMap[data.designationName] || null;
      if (!designationId) {
        console.warn(
          `  ⚠️  Designation "${data.designationName}" not found for ${email}; saving without designation`,
        );
      }

      const role = roleCache.get(data.roleName);

      const employee = new Employee({
        employeeId: nextEmployeeId(),
        firstName: data.firstName,
        middleName: data.middleName,
        lastName: data.lastName,
        email,
        position: data.position,
        employeeType: data.employeeType,
        division: getDivision(data.office),
        password: TEST_PASSWORD,
        role: role._id,
        project: projectRecord._id,
        designation: designationId,
        status: "Active",
      });

      await employee.save();
      inserted++;
      console.log(
        `  ➕ Inserted: ${data.firstName} ${data.lastName} <${email}> [${employee.employeeId}] (${data.roleName}, ${data.employeeType}, ${employee.division})`,
      );
    } catch (err) {
      failed++;
      const details = err?.errors
        ? Object.values(err.errors)
            .map((e) => e.message)
            .join("; ")
        : err.message;
      console.error(`  ❌ Failed: ${data.email} → ${details}`);
    }
  }

  console.log(
    `\n✅ Done. Inserted: ${inserted}, Skipped: ${skipped}, Failed: ${failed}`,
  );
  if (inserted > 0) {
    console.log(`🔐 Password for all test accounts: ${TEST_PASSWORD}`);
  }
  return failed;
};

/* ------------------ RUNNER ------------------ */
const run = async () => {
  if (!process.env.MONGO_URI) {
    console.error(
      "❌ MONGO_URI is not set. Run with: node --env-file=.env.production seeders/seed-test.js",
    );
    process.exit(1);
  }

  const isClean = process.argv.includes("--clean");

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(
      `✅ Connected to MongoDB (database: "${mongoose.connection.name}")`,
    );

    let failed = 0;
    if (isClean) {
      console.log("⏳ Removing test accounts...");
      await cleanTestEmployees();
    } else {
      console.log("⏳ Seeding test accounts...");
      failed = await seedTestEmployees();
    }

    await mongoose.disconnect();
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
};

run();
