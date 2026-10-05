require("../config/loadEnv");
const mongoose = require("mongoose");

const Employee = require("../models/employeeModel");
const Designation = require("../models/designationModel");
const Role = require("../models/roleModel");
const Project = require("../models/projectModel");

const employeesToSeed = [
  {
    lastName: "ABAD",
    firstName: "FERDINAND",
    middleName: "BARIUAN",
    position: "CEO III",
    email: "ferdie.abad@dict.gov.ph",
    office: "Cagayan Provincial Office",
    designationName: "Cagayan Provincial Office",
  },
  {
    lastName: "ABRIGO",
    firstName: "LOT-LOT",
    middleName: "ACERA",
    position: "Budget Officer II",
    email: "lotlot.acera@dict.gov.ph",
    office: "Regional Office, Administrative and Finance Division",
    designationName: "Regional Office",
  },
  {
    lastName: "AGAOID",
    firstName: "EDISON",
    middleName: "SALVADOR",
    position: "ISA I",
    email: "edison.agaoid@dict.gov.ph",
    office: "Quirino Provincial Office",
    designationName: "Quirino Provincial Office",
  },
  {
    lastName: "AMMASI",
    firstName: "JAYFER",
    middleName: "TABAO-ICAN",
    position: "HRMO II",
    email: "jayfer.ammasi@dict.gov.ph",
    office: "Regional Office, Administrative and Finance Division",
    designationName: "Regional Office",
  },
  {
    lastName: "BACULI",
    firstName: "VIRGINIA",
    middleName: "CABADDU",
    position: "ITO II (Quirino PO)",
    email: "gie.baculi@dict.gov.ph",
    office: "Isabela Provincial Office - Santiago",
    designationName: "Isabela Provincial Office - Santiago City",
  },
  {
    lastName: "BALIGOD",
    firstName: "RICHARD",
    middleName: "PINEDA",
    position: "ECET I",
    email: "ricky.baligod@dict.gov.ph",
    office: "Cagayan Provincial Office",
    designationName: "Cagayan Provincial Office",
  },
  {
    lastName: "BARIUAN",
    firstName: "RONALD",
    middleName: "SIUGAN",
    position: "ITO II (Batanes PO)",
    email: "ronie.bariuan@dict.gov.ph",
    office: "Batanes Provincial Office",
    designationName: "Batanes Provincial Office",
  },
  {
    lastName: "BATANG",
    firstName: "JOHNY",
    middleName: "CALAYAN",
    position: "ENGR III",
    email: "johny.batang@dict.gov.ph",
    office: "Cagayan Provincial Office",
    designationName: "Cagayan Provincial Office",
  },
  {
    lastName: "BERMEJO",
    firstName: "ALVIN",
    middleName: "BALIGOD",
    position: "ECET I",
    email: "alvin.bermejo@dict.gov.ph",
    office: "Cagayan Provincial Office",
    designationName: "Cagayan Provincial Office",
  },
  {
    lastName: "BUENO",
    firstName: "CHRISTINE JOYCE",
    middleName: "VILLALUZ",
    position: "Cashier II",
    email: "christine.bueno@dict.gov.ph",
    office: "Regional Office, Administrative and Finance Division",
    designationName: "Regional Office",
  },
  {
    lastName: "CABACUNGAN",
    firstName: "LANIE",
    middleName: "AGTARAP",
    position: "CEO III",
    email: "lanie.cabacungan@dict.gov.ph",
    office: "Isabela Provincial Office - Santiago",
    designationName: "Isabela Provincial Office - Santiago City",
  },
  {
    lastName: "CABACUNGAN",
    firstName: "MEDY JOSE",
    middleName: "MOSADAS",
    position: "MPO II (QUIRINO/SANTIAGO)",
    email: "jose.cabacungan@dict.gov.ph",
    office: "Isabela Provincial Office - Santiago",
    designationName: "Isabela Provincial Office - Santiago City",
  },
  {
    lastName: "CANO",
    firstName: "ADELMO",
    middleName: "GATO",
    position: "CEO II",
    email: "delmo.cano@dict.gov.ph",
    office: "Batanes Provincial Office",
    designationName: "Batanes Provincial Office",
  },
  {
    lastName: "DAWIDEO",
    firstName: "SAMANTHA",
    middleName: "PAYUKET",
    position: "ADAS III",
    email: "samantha.dawideo@dict.gov.ph",
    office: "Regional Office, Office of the Regional Director",
    designationName: "Regional Office",
  },
  {
    lastName: "DEL ROSARIO",
    firstName: "JEMAR JAY",
    middleName: "CALAYAN",
    position: "Accountant III",
    email: "jemar.delrosario@dict.gov.ph",
    office: "Regional Office, Administrative and Finance Division",
    designationName: "Regional Office",
  },
  {
    lastName: "DOMINGO",
    firstName: "ELON",
    middleName: "FLORES",
    position: "CEO II",
    email: "elon.domingo@dict.gov.ph",
    office: "Regional Office, Administrative and Finance Division",
    designationName: "Regional Office",
  },
  {
    lastName: "ELCHICO",
    firstName: "JOEY MARK",
    middleName: "DE GUZMAN",
    position: "ITO I",
    email: "joeymark.elchico@dict.gov.ph",
    office: "Regional Office, Technical Operations Division",
    designationName: "Regional Office",
  },
  {
    lastName: "FUGABAN",
    firstName: "PABLO",
    middleName: "GERALDO",
    position: "Admin Aide IV/Driver II",
    email: "pablo.fugaban@dict.gov.ph",
    office: "Regional Office, Administrative and Finance Division",
    designationName: "Regional Office",
  },
  {
    lastName: "GAZZINGAN",
    firstName: "CIRILO",
    middleName: "NACINO",
    nameExtension: "JR.",
    position: "ITO II (Isabela PO)",
    email: "jr.gazzingan@dict.gov.ph",
    office: "Isabela Provincial Office - Cauayan",
    designationName: "Isabela Provincial Office - Cauayan City",
  },
  {
    lastName: "GOMEZ",
    firstName: "MAGDALENA",
    middleName: "DACUYCUY",
    position: "ITO III (TOD Chief)",
    email: "magie.gomez@dict.gov.ph",
    office: "Regional Office, Technical Operations Division",
    designationName: "Regional Office",
  },
  {
    lastName: "HUBALDE",
    firstName: "ROLAND",
    middleName: "BARTILAD",
    position: "CEO II",
    email: "roland.hubalde@dict.gov.ph",
    office: "Batanes Provincial Office",
    designationName: "Batanes Provincial Office",
  },
  {
    lastName: "JIMENEZ",
    firstName: "PINKY",
    middleName: "TUMALIUAN",
    position: "Director IV (Regional Director)",
    email: "pinky.jimenez@dict.gov.ph",
    office: "Regional Office, Office of the Regional Director",
    designationName: "Regional Office",
  },
  {
    lastName: "LAVERINTO",
    firstName: "JEOY",
    middleName: "GALAPON",
    position: "Director III (Assistant Regional Director)",
    email: "jg.laverinto@dict.gov.ph",
    office: "Regional Office, Office of the Asst. Regional Director",
    designationName: "Regional Office",
  },
  {
    lastName: "LAYUGAN",
    firstName: "ROGELIO",
    middleName: "TAGUIBAO",
    position: "ITO II (Cagayan PO)",
    email: "rogelio.layugan@dict.gov.ph",
    office: "Cagayan Provincial Office",
    designationName: "Cagayan Provincial Office",
  },
  {
    lastName: "MAGGAY",
    firstName: "CLARO",
    middleName: "MATAMMU",
    position: "ECET I",
    email: "claro.maggay@dict.gov.ph",
    office: "Regional Office, Administrative and Finance Division",
    designationName: "Regional Office",
  },
  {
    lastName: "MANUEL",
    firstName: "EDWARD",
    middleName: "CABUTAJE",
    position: "CEO III",
    email: "edward.manuel@dict.gov.ph",
    office: "Regional Office, Administrative and Finance Division",
    designationName: "Regional Office",
  },
  {
    lastName: "MANUEL",
    firstName: "EDMUND",
    middleName: "CABUTAJE",
    position: "CEO III",
    email: "edmund.manuel@dict.gov.ph",
    office: "Regional Office, Administrative and Finance Division",
    designationName: "Regional Office",
  },
  {
    lastName: "NAZARITA",
    firstName: "CONCEPCION",
    middleName: "CABALONGA",
    position: "CEO III",
    email: "conie.nazarita@dict.gov.ph",
    office: "Isabela Provincial Office - Cauayan",
    designationName: "Isabela Provincial Office - Cauayan City",
  },
  {
    lastName: "PABRO",
    firstName: "EUGENE",
    middleName: "LOMPERO",
    position: "CEO III",
    email: "eugene.pabro@dict.gov.ph",
    office: "Isabela Provincial Office - Cauayan",
    designationName: "Isabela Provincial Office - Cauayan City",
  },
  {
    lastName: "RAMIREZ",
    firstName: "DANIEL",
    middleName: "PADILLA",
    position: "CEO III",
    email: "daniel.ramirez@dict.gov.ph",
    office: "Isabela Provincial Office - Cauayan",
    designationName: "Isabela Provincial Office - Cauayan City",
  },
  {
    lastName: "ROBLES",
    firstName: "MARILYN",
    middleName: "FLORES",
    position: "CEO II",
    email: "marilyn.robles@dict.gov.ph",
    office: "Isabela Provincial Office - Cauayan",
    designationName: "Isabela Provincial Office - Cauayan City",
  },
  {
    lastName: "TULAUAN",
    firstName: "JOHANNA",
    middleName: "FERIDO",
    position: "ITO I (N. Vizcaya PO)",
    email: "johanna.tulauan@dict.gov.ph",
    office: "Nueva Vizcaya Provincial Office",
    designationName: "Nueva Vizcaya Provincial Office",
  },
  {
    lastName: "TUMALIUAN",
    firstName: "MARK JOHN",
    middleName: "CUDIAMAT",
    position: "Admin Aide IV/Driver II",
    email: "markjohn.tumaliuan@dict.gov.ph",
    office: "Regional Office, Office of the Regional Director",
    designationName: "Regional Office",
  },
  {
    lastName: "TUMALIUAN",
    firstName: "NODELME",
    middleName: "MAN",
    position: "Admin Aide IV/Driver II",
    email: "nodel.tumaliuan@dict.gov.ph",
    office: "Regional Office, Administrative and Finance Division",
    designationName: "Regional Office",
  },
  {
    lastName: "VILLAFUERTE",
    firstName: "MINA",
    middleName: "",
    position: "CAO (AFD Chief)",
    email: "mina.villafuerte@dict.gov.ph",
    office: "Regional Office, Administrative and Finance Division",
    designationName: "Regional Office",
  },
];

const ID_PREFIX = "DICT";
const DEFAULT_PASSWORD = "Password@2026!";

// Name/position fields kept in sync for employees that already exist
const SYNC_FIELDS = [
  "firstName",
  "middleName",
  "lastName",
  "nameExtension",
  "position",
];

const getDivision = (officeString = "") => {
  const lowerOffice = officeString.toLowerCase();
  if (lowerOffice.includes("administrative and finance")) return "AFD";
  if (lowerOffice.includes("regional director")) return "ORD";
  return "TOD"; // Defaults Provincial Offices and Technical Operations to TOD
};

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const findRole = (name) =>
  Role.findOne({ name: { $regex: new RegExp(`^${escapeRegex(name)}$`, "i") } });

const formatName = (e) =>
  [
    e.firstName,
    e.middleName ? `${e.middleName.charAt(0)}.` : "",
    e.lastName,
    e.nameExtension || "",
  ]
    .filter(Boolean)
    .join(" ");

// Finds the next free DICT-### id so it never collides with existing records
const makeIdGenerator = async () => {
  const idRegex = new RegExp(`^${escapeRegex(ID_PREFIX)}-\\d+$`);
  const existing = await Employee.find(
    { employeeId: { $regex: idRegex } },
    { employeeId: 1 },
  ).lean();

  const used = new Set(existing.map((e) => e.employeeId));
  let n = 1;

  return () => {
    while (used.has(`${ID_PREFIX}-${String(n).padStart(3, "0")}`)) n++;
    const id = `${ID_PREFIX}-${String(n).padStart(3, "0")}`;
    used.add(id);
    return id;
  };
};

// Normalized value from the seed data for a sync field
const seedValue = (data, field) => String(data[field] ?? "").trim();

/* ------------------ CLEAN MODE ------------------ */
// Deletes ONLY the employees listed in employeesToSeed (matched by email).
// Without --yes it is a preview (dry run) and deletes nothing.
const cleanEmployees = async ({ confirmed }) => {
  const emails = employeesToSeed.map((d) => d.email.trim().toLowerCase());

  const found = await Employee.find(
    { email: { $in: emails }, employeeType: "Organic" },
    {
      email: 1,
      employeeId: 1,
      firstName: 1,
      middleName: 1,
      lastName: 1,
      nameExtension: 1,
    },
  )
    .sort({ employeeId: 1 })
    .lean();

  if (found.length === 0) {
    console.log(
      "ℹ️  None of the employees in this seeder exist. Nothing to delete.",
    );
    return 0;
  }

  found.forEach((e) =>
    console.log(
      `  ${confirmed ? "🗑️  Deleting" : "👀 Would delete"}: ${formatName(e)} <${e.email}> [${e.employeeId || "no id"}]`,
    ),
  );

  if (!confirmed) {
    console.log(
      `\n⚠️  Preview only: ${found.length} employee(s) would be deleted.` +
        `\n   To actually delete them, run again with:  --clean --yes`,
    );
    return 0;
  }

  const result = await Employee.deleteMany({
    _id: { $in: found.map((e) => e._id) },
  });
  console.log(`\n✅ Deleted ${result.deletedCount} employee(s).`);
  return 0;
};

/* ------------------ SEED MODE ------------------ */
const seedEmployees = async () => {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  // 1. "regular" role for organic employees
  const regularRole = await findRole("regular");
  if (!regularRole) {
    const available = await Role.find({}, { name: 1 }).lean();
    throw new Error(
      `Role "regular" not found. Roles in this database: [${
        available.map((r) => r.name).join(", ") || "none"
      }]. Run your Role seeder first.`,
    );
  }

  // 2. "N/A" project so Mongoose validation passes
  let naProject = await Project.findOne({ name: "N/A" });
  if (!naProject) {
    naProject = await Project.create({ name: "N/A", status: "Active" });
    console.log("  📌 Created 'N/A' project.");
  }

  // 3. Designations
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

  // 4. Employees (.save() triggers bcrypt hashing; one failure does not stop the rest)
  for (const data of employeesToSeed) {
    try {
      const email = data.email.trim().toLowerCase();

      const existing = await Employee.findOne(
        { email },
        {
          _id: 1,
          firstName: 1,
          middleName: 1,
          lastName: 1,
          nameExtension: 1,
          position: 1,
        },
      ).lean();

      if (existing) {
        // Keep name and position in sync with this list for already-seeded employees
        const changes = {};
        for (const field of SYNC_FIELDS) {
          const current = String(existing[field] ?? "").trim();
          const desired = seedValue(data, field);
          if (current !== desired) changes[field] = desired;
        }

        if (Object.keys(changes).length > 0) {
          await Employee.updateOne({ _id: existing._id }, { $set: changes });
          updated++;
          const summary = Object.entries(changes)
            .map(([k, v]) => `${k}: "${existing[k] ?? ""}" → "${v}"`)
            .join(", ");
          console.log(`  ✏️  Updated ${email} (${summary})`);
        } else {
          skipped++;
          console.log(`  ⏩ Skipped: ${email} (already up to date)`);
        }
        continue;
      }

      const designationId = designationMap[data.designationName] || null;
      if (!designationId) {
        console.warn(
          `  ⚠️  Designation "${data.designationName}" not found for ${email}; saving without designation`,
        );
      }

      const employee = new Employee({
        employeeId: nextEmployeeId(),
        firstName: data.firstName,
        middleName: data.middleName,
        lastName: data.lastName,
        nameExtension: data.nameExtension || "",
        email,
        position: data.position,
        employeeType: "Organic",
        division: getDivision(data.office),
        password: DEFAULT_PASSWORD,
        role: regularRole._id,
        project: naProject._id,
        designation: designationId,
        status: "Active",
      });

      await employee.save();
      inserted++;
      console.log(
        `  ➕ Inserted: ${formatName(data)} [${employee.employeeId}] (${employee.division})`,
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
    `\n✅ Done. Inserted: ${inserted}, Updated: ${updated}, Skipped: ${skipped}, Failed: ${failed}`,
  );
  return failed;
};

/* ------------------ RUNNER ------------------ */
const run = async () => {
  if (!process.env.MONGO_URI) {
    console.error(
      "❌ MONGO_URI is not set. Run with: node --env-file=.env.production seeders/<this-file>.js",
    );
    process.exit(1);
  }

  const isClean = process.argv.includes("--clean");
  const confirmed = process.argv.includes("--yes");

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(
      `✅ Connected to MongoDB (database: "${mongoose.connection.name}")`,
    );

    let failed = 0;
    if (isClean) {
      console.log(
        confirmed
          ? "⏳ Deleting Organic employees from this seeder..."
          : "⏳ Previewing Organic employees that would be deleted...",
      );
      failed = await cleanEmployees({ confirmed });
    } else {
      console.log("⏳ Seeding Organic Employees...");
      failed = await seedEmployees();
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
