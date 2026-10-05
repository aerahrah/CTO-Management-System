require("../config/loadEnv");
const mongoose = require("mongoose");

const Employee = require("../models/employeeModel");
const Designation = require("../models/designationModel");
const Role = require("../models/roleModel");
const Project = require("../models/projectModel");

const joEmployeesData = [
  // --- PNPKI / CYBERSECURITY ---
  {
    lastName: "SUYU",
    firstName: "KYLE RUZZEL",
    middleName: "CARONAN",
    position: "PLO II",
    email: "kyle.suyu@dict.gov.ph",
    projectName: "PNPKI",
    office: "Regional Office, Technical Operations Division",
    designationName: "Regional Office",
  },
  {
    lastName: "ALONZO",
    firstName: "BIEGH JOHN PAUL",
    middleName: "BASSIG",
    position: "IO II",
    email: "bieghjohn.alonzo@dict.gov.ph",
    projectName: "PNPKI",
    office: "Isabela Provincial Office - Cauayan",
    designationName: "Isabela Provincial Office - Cauayan City",
  },
  {
    lastName: "PILOTIN",
    firstName: "MA. ELIJAH",
    middleName: "HUGO",
    position: "IO I",
    email: "maelijah.pilotin@dict.gov.ph",
    projectName: "PNPKI",
    office: "Nueva Vizcaya Provincial Office",
    designationName: "Nueva Vizcaya Provincial Office",
  },
  {
    lastName: "GUISANDO",
    firstName: "JAYSON",
    middleName: "SERVILLA",
    position: "IO I",
    email: "jayson.guisando@dict.gov.ph",
    projectName: "PNPKI",
    office: "Regional Office, Administrative and Finance Division",
    designationName: "Regional Office",
  },
  {
    lastName: "MAGGAY",
    firstName: "MAYLANIE",
    middleName: "ORDOÑO",
    position: "IO I",
    email: "maylanie.maggay@dict.gov.ph",
    projectName: "PNPKI",
    office: "Cagayan Provincial Office",
    designationName: "Cagayan Provincial Office",
  },
  {
    lastName: "ALVARADO",
    firstName: "ENRIQUE LUIS",
    middleName: "PONCE",
    position: "IO I",
    email: "enriqueluis.alvarado@dict.gov.ph",
    projectName: "PNPKI",
    office: "Quirino Provincial Office",
    designationName: "Quirino Provincial Office",
  },

  // --- ILCDB ---
  {
    lastName: "CASUGA",
    firstName: "RICA",
    middleName: "VALENTINO",
    position: "PDO II",
    email: "rica.casuga@dict.gov.ph",
    projectName: "ILCDB",
    office: "Regional Office, Technical Operations Division",
    designationName: "Regional Office",
  },
  {
    lastName: "ANAPI",
    firstName: "DEEJAY",
    middleName: "GATAN",
    position: "PDO II",
    email: "deejay.anapi@dict.gov.ph",
    projectName: "ILCDB",
    office: "Cagayan Provincial Office",
    designationName: "Cagayan Provincial Office",
  },
  {
    lastName: "VALDEZ",
    firstName: "MARIA KRISTINE",
    middleName: "TAGUINOD",
    position: "PDO II",
    email: "kristine.valdez@dict.gov.ph",
    projectName: "ILCDB",
    office: "Isabela Provincial Office - Cauayan",
    designationName: "Isabela Provincial Office - Cauayan City",
  },
  {
    lastName: "AGUDA",
    firstName: "CHRISTIAN DALE",
    middleName: "COSTALES",
    position: "PDO I",
    email: "christiandale.aguda@dict.gov.ph",
    projectName: "ILCDB",
    office: "Regional Office, Technical Operations Division",
    designationName: "Regional Office",
  },
  {
    lastName: "BACKIAWAN",
    firstName: "DEBORA",
    middleName: "PIDO",
    position: "PDO I",
    email: "debora.backiawan@dict.gov.ph",
    projectName: "ILCDB",
    office: "Nueva Vizcaya Provincial Office",
    designationName: "Nueva Vizcaya Provincial Office",
  },
  {
    lastName: "CLARO",
    firstName: "EXEN",
    middleName: "BANTIYAN",
    position: "PDO I",
    email: "exen.claro@dict.gov.ph",
    projectName: "ILCDB",
    office: "Quirino Provincial Office",
    designationName: "Quirino Provincial Office",
  },
  {
    lastName: "TELMO",
    firstName: "NYSSA MAE",
    middleName: "HORDONEZ",
    position: "PDO I",
    email: "nyssamae.telmo@dict.gov.ph",
    projectName: "ILCDB",
    office: "Batanes Provincial Office",
    designationName: "Batanes Provincial Office",
  },
  {
    lastName: "MACABANGUN",
    firstName: "JASMINE",
    middleName: "ESLABON",
    position: "PDO I",
    email: "jasmine.macabangun@dict.gov.ph",
    projectName: "ILCDB",
    office: "Isabela Provincial Office - Santiago",
    designationName: "Isabela Provincial Office - Santiago City",
  },

  // --- IIDB ---
  {
    lastName: "SEGURITAN",
    firstName: "DARLENE JOY",
    middleName: "BASSIG",
    position: "PDO II",
    email: "darlenejoy.seguritan@dict.gov.ph",
    projectName: "IIDB",
    office: "Cagayan Provincial Office",
    designationName: "Cagayan Provincial Office",
  },

  // --- MISS ---
  {
    lastName: "GUIM",
    firstName: "ARIES ANTHONY",
    middleName: "FUGGAY",
    position: "CMT II",
    email: "aries.guim@dict.gov.ph",
    projectName: "MISS",
    office: "Regional Office, Technical Operations Division",
    designationName: "Regional Office",
  },

  // --- NIPPSB ---
  {
    lastName: "JIMENEZ",
    firstName: "JEI ARISTON",
    middleName: "CASTILLO",
    position: "PLO I",
    email: "jeiariston.jimenez@dict.gov.ph",
    projectName: "NIPPSB",
    office: "Regional Office, Technical Operations Division",
    designationName: "Regional Office",
  },

  // --- GOVNET ---
  {
    lastName: "JOSE",
    firstName: "DAN MARK",
    middleName: "RILLERA",
    position: "Engineer II",
    email: "danmark.jose@dict.gov.ph",
    projectName: "GOVNET",
    office: "Regional Office, Technical Operations Division",
    designationName: "Regional Office",
  },

  // --- GECS ---
  {
    lastName: "RAFER",
    firstName: "YANCEE KEARVIN KYLE",
    middleName: "AQUINO",
    position: "Engineer II",
    email: "kyle.rafer@dict.gov.ph",
    projectName: "GECS",
    office: "Regional Office, Technical Operations Division",
    designationName: "Regional Office",
  },
  {
    lastName: "MARTIN",
    firstName: "GLENARD",
    middleName: "FERNANDO",
    position: "Engineer I",
    email: "glenard.martin@dict.gov.ph",
    projectName: "GECS",
    office: "Regional Office, Technical Operations Division",
    designationName: "Regional Office",
  },
  {
    lastName: "LIM",
    firstName: "NARDO",
    middleName: "ABARRA",
    position: "Admin. Aide IV (Driver II)",
    email: "nardo.lim@dict.gov.ph",
    projectName: "GECS",
    office: "Regional Office, Technical Operations Division",
    designationName: "Regional Office",
  },

  // --- FPIAP ---
  {
    lastName: "CATINOY",
    firstName: "JANET",
    middleName: "TUNQUE",
    position: "Engineer III",
    email: "janet.catinoy@dict.gov.ph",
    projectName: "FPIAP",
    office: "Regional Office, Technical Operations Division",
    designationName: "Regional Office",
  },
  {
    lastName: "CEPEDA",
    firstName: "CYRILL SHANE",
    middleName: "TAGUIAM",
    position: "Engineer II",
    email: "cyrill.cepeda@dict.gov.ph",
    projectName: "FPIAP",
    office: "Regional Office, Technical Operations Division",
    designationName: "Regional Office",
  },
  {
    lastName: "GUIMMAYEN",
    firstName: "NEIL KRISTOPHER",
    middleName: "CONEL",
    position: "Engineer II",
    email: "neilkristopher.guimmayen@dict.gov.ph",
    projectName: "FPIAP",
    office: "Regional Office, Technical Operations Division",
    designationName: "Regional Office",
  },
  {
    lastName: "MENDOZA",
    firstName: "CZYIONE DAYL",
    middleName: "ASUNCION",
    position: "PLO II",
    email: "cyzione.mendoza@dict.gov.ph",
    projectName: "FPIAP",
    office: "Regional Office, Technical Operations Division",
    designationName: "Regional Office",
  },
  {
    lastName: "GALOLO",
    firstName: "LEAH",
    middleName: "GALAROSSA",
    position: "PDO II",
    email: "leah.galolo@dict.gov.ph",
    projectName: "FPIAP",
    office: "Batanes Provincial Office",
    designationName: "Batanes Provincial Office",
  },
  {
    lastName: "BANAN",
    firstName: "RITO",
    middleName: "GUMARANG",
    position: "PLO II",
    email: "rito.banan@dict.gov.ph",
    projectName: "FPIAP",
    office: "Regional Office, Technical Operations Division",
    designationName: "Regional Office",
  },
  {
    lastName: "JIMENEZ",
    firstName: "ROEL",
    middleName: "URSUA",
    position: "PDO II",
    email: "roel.jimenez@dict.gov.ph",
    projectName: "FPIAP",
    office: "Regional Office, Technical Operations Division",
    designationName: "Regional Office",
  },
  {
    lastName: "CAPILI",
    firstName: "CHRISTOPHER ELEESON",
    middleName: "LARGADO",
    position: "Engineer I",
    email: "christopher.capili@dict.gov.ph",
    projectName: "FPIAP",
    office: "Regional Office, Technical Operations Division",
    designationName: "Regional Office",
  },
  {
    lastName: "NUVAL",
    firstName: "VLADIMIR VIKTOR",
    middleName: "GACUTAN",
    position: "PMO I",
    email: "vladimir.nuval@dict.gov.ph",
    projectName: "FPIAP",
    office: "Regional Office, Technical Operations Division",
    designationName: "Regional Office",
  },

  // --- DIGIGOV ---
  {
    lastName: "PECSON",
    firstName: "MARICAR",
    middleName: "SORIANO",
    position: "ITO I",
    email: "maricar.pecson@dict.gov.ph",
    projectName: "DigiGov",
    office: "Regional Office, Technical Operations Division",
    designationName: "Regional Office",
  },
  {
    lastName: "RECOLIZADO",
    firstName: "JAYMAR",
    middleName: "CORSINO",
    position: "ISA III",
    email: "jaymar.recolizado@dict.gov.ph",
    projectName: "DigiGov",
    office: "Regional Office, Technical Operations Division",
    designationName: "Regional Office",
  },
  {
    lastName: "USMAN",
    firstName: "MOHAMADNOR",
    middleName: "GURO",
    position: "PDO I",
    email: "mohamadnor.usman@dict.gov.ph",
    projectName: "DigiGov",
    office: "Regional Office, Technical Operations Division",
    designationName: "Regional Office",
  },
  {
    lastName: "PEDRO",
    firstName: "HENNESSI",
    middleName: "SINABAN",
    position: "PDO I",
    email: "hennessi.pedro@dict.gov.ph",
    projectName: "DigiGov",
    office: "Regional Office, Technical Operations Division",
    designationName: "Regional Office",
  },
  {
    lastName: "URDILLAS",
    firstName: "JOYCE ANN",
    middleName: "PADER",
    position: "PDO I",
    email: "joyceanne.urdillas@dict.gov.ph",
    projectName: "DigiGov",
    office: "Regional Office, Technical Operations Division",
    designationName: "Regional Office",
  },
  {
    lastName: "ABBAS",
    firstName: "ALISON",
    middleName: "AHMAD",
    position: "PDO II",
    email: "alison.abbas@dict.gov.ph",
    projectName: "DigiGov",
    office: "Batanes Provincial Office",
    designationName: "Batanes Provincial Office",
  },
  {
    lastName: "ALILAM",
    firstName: "LEO JAY",
    middleName: "LORENZO",
    position: "PDO I",
    email: "leo.alilam@dict.gov.ph",
    projectName: "DigiGov",
    office: "Cagayan Provincial Office",
    designationName: "Cagayan Provincial Office",
  },
  {
    lastName: "TOMAS",
    firstName: "BRYAN",
    middleName: "HIDALGO",
    position: "ISA II",
    email: "bryan.tomas@dict.gov.ph",
    projectName: "DigiGov",
    office: "Isabela Provincial Office - Cauayan",
    designationName: "Isabela Provincial Office - Cauayan City",
  },
  {
    lastName: "MACASADDU",
    firstName: "MARIA EA KATRINA",
    middleName: "GUMARU",
    position: "PDO I",
    email: "maria.macasaddu@dict.gov.ph",
    projectName: "DigiGov",
    office: "Isabela Provincial Office - Cauayan",
    designationName: "Isabela Provincial Office - Cauayan City",
  },
  {
    lastName: "BAYLON",
    firstName: "JESUS",
    middleName: "B",
    position: "PDO III",
    email: "jesus.baylon@dict.gov.ph",
    projectName: "DigiGov",
    office: "Isabela Provincial Office - Cauayan",
    designationName: "Isabela Provincial Office - Cauayan City",
  },
  {
    lastName: "GARCIA",
    firstName: "JEANNE SHANNON",
    middleName: "ORIAL",
    position: "ISA II",
    email: "jeanne.garcia@dict.gov.ph",
    projectName: "DigiGov",
    office: "Quirino Provincial Office",
    designationName: "Quirino Provincial Office",
  },
  {
    lastName: "MADDELA",
    firstName: "KARL STEVEN",
    middleName: "ADALEM",
    position: "PDO III",
    email: "karlsteven.maddela@dict.gov.ph",
    projectName: "DigiGov",
    office: "Nueva Vizcaya Provincial Office",
    designationName: "Nueva Vizcaya Provincial Office",
  },
  {
    lastName: "ABAD",
    firstName: "DIETHER",
    middleName: "ALBANO",
    position: "ISA I",
    email: "diether.abad@dict.gov.ph",
    projectName: "DigiGov",
    office: "Nueva Vizcaya Provincial Office",
    designationName: "Nueva Vizcaya Provincial Office",
  },
  {
    lastName: "GUILLERMO",
    firstName: "MARC IVAN",
    middleName: "DIZON",
    position: "ISA I",
    email: "marcivan.guillermo@dict.gov.ph",
    projectName: "DigiGov",
    office: "Isabela Provincial Office - Santiago",
    designationName: "Isabela Provincial Office - Santiago City",
  },

  // --- MOOE ---
  {
    lastName: "BAQUIRAN",
    firstName: "JULIUS CEZAR",
    middleName: "CALIGUIRAN",
    position: "Administrative Officer II",
    email: "juliuscezar.baquiran@dict.gov.ph",
    projectName: "MOOE",
    office: "Regional Office, Administrative and Finance Division",
    designationName: "Regional Office",
  },
  {
    lastName: "VILLAGRACIA",
    firstName: "KATE ANGELIE",
    middleName: "MARTINEZ",
    position: "Administrative Officer II",
    email: "kate.villagracia@dict.gov.ph",
    projectName: "MOOE",
    office: "Regional Office, Administrative and Finance Division",
    designationName: "Regional Office",
  },
  {
    lastName: "PRUDENCIADO",
    firstName: "JENNY",
    middleName: "SALA",
    position: "Admin. Officer II (Budget Officer I)",
    email: "jenny.prudenciado@dict.gov.ph",
    projectName: "MOOE",
    office: "Regional Office, Administrative and Finance Division",
    designationName: "Regional Office",
  },
  {
    lastName: "TUMALIUAN",
    firstName: "LEONOR",
    middleName: "JUANDAY",
    position: "Admin. Officer II (HRMO I)",
    email: "leonor.tumaliuan@dict.gov.ph",
    projectName: "MOOE",
    office: "Regional Office, Administrative and Finance Division",
    designationName: "Regional Office",
  },
  {
    lastName: "BAQUIRAN",
    firstName: "MAR ELVISON",
    middleName: "ANGOBUNG",
    position: "Admin. Ofcr I (Records Officer I)",
    email: "mar.baquiran@dict.gov.ph",
    projectName: "MOOE",
    office: "Regional Office, Administrative and Finance Division",
    designationName: "Regional Office",
  },
  {
    lastName: "CARUNGI",
    firstName: "RICA MAE",
    middleName: "MARCOS",
    position: "Admin. Ofcr I (Supply Officer I)",
    email: "ricamae.carungi@dict.gov.ph",
    projectName: "MOOE",
    office: "Regional Office, Administrative and Finance Division",
    designationName: "Regional Office",
  },
  {
    lastName: "ARIMBUYOTAN",
    firstName: "ROMELYN",
    middleName: "RAMORAN",
    position: "Admin. Ofcr I (Cashier I)",
    email: "romelyn.arimbuyotan@dict.gov.ph",
    projectName: "MOOE",
    office: "Regional Office, Administrative and Finance Division",
    designationName: "Regional Office",
  },
  {
    lastName: "ALBANO",
    firstName: "JANAH PATRISHA",
    middleName: "DIVINA",
    position: "Admin. Asst II (Admin Asst.)",
    email: "janahpatrisha.albano@dict.gov.ph",
    projectName: "MOOE",
    office: "Regional Office, Administrative and Finance Division",
    designationName: "Regional Office",
  },
  {
    lastName: "SANTOS",
    firstName: "IVANN PAUL",
    middleName: "MATIAS",
    position: "Admin Aide IV",
    email: "ivannpaul.santos@dict.gov.ph",
    projectName: "MOOE",
    office: "Regional Office, Administrative and Finance Division",
    designationName: "Regional Office",
  },
];

const ADMIN_EMAIL = "marcivan.guillermo@dict.gov.ph";
const DEFAULT_PASSWORD = "Password@2026!";

const getDivision = (officeString = "") => {
  const lowerOffice = officeString.toLowerCase();
  if (lowerOffice.includes("administrative and finance")) return "AFD";
  return "TOD";
};

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const findRole = (name) =>
  Role.findOne({ name: { $regex: new RegExp(`^${escapeRegex(name)}$`, "i") } });

// Finds the next free JO-### id so it never collides with existing records
const makeIdGenerator = async () => {
  const existing = await Employee.find(
    { employeeId: { $regex: /^JO-\d+$/ } },
    { employeeId: 1 },
  ).lean();

  const used = new Set(existing.map((e) => e.employeeId));
  let n = 1;

  return () => {
    while (used.has(`JO-${String(n).padStart(3, "0")}`)) n++;
    const id = `JO-${String(n).padStart(3, "0")}`;
    used.add(id);
    return id;
  };
};

const seedJoEmployees = async () => {
  if (!process.env.MONGO_URI) {
    console.error(
      "❌ MONGO_URI is not set. Run with: node --env-file=.env.production seeders/seed-joEmployee.js",
    );
    process.exit(1);
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(
      `✅ Connected to MongoDB (database: "${mongoose.connection.name}")`,
    );
    console.log("⏳ Seeding Job Order (JO) Employees...");

    // 1. Roles
    const joRole = await findRole("jo");
    const adminRole = await findRole("admin");

    if (!joRole || !adminRole) {
      const available = await Role.find({}, { name: 1 }).lean();
      throw new Error(
        `Required roles not found (jo: ${!!joRole}, admin: ${!!adminRole}). ` +
          `Roles in this database: [${available.map((r) => r.name).join(", ") || "none"}]. ` +
          `Run your Role seeder first.`,
      );
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

    // 3. Employees (one failure does not stop the rest)
    for (const data of joEmployeesData) {
      try {
        const email = data.email.trim().toLowerCase();

        const existing = await Employee.findOne(
          { email },
          { _id: 1, position: 1 },
        ).lean();

        if (existing) {
          // Sync position format (e.g. "PLO 1" -> "PLO I") for already-seeded employees
          if (existing.position !== data.position) {
            await Employee.updateOne(
              { _id: existing._id },
              { $set: { position: data.position } },
            );
            updated++;
            console.log(
              `  ✏️  Updated position: ${email} ("${existing.position}" → "${data.position}")`,
            );
          } else {
            skipped++;
            console.log(`  ⏩ Skipped: ${email} (already exists)`);
          }
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

        const isAdmin = email === ADMIN_EMAIL;
        if (isAdmin) {
          console.log(
            `  🔑 Granting SYSTEM ADMIN to ${data.firstName} ${data.lastName}`,
          );
        }

        const employee = new Employee({
          employeeId: nextEmployeeId(),
          firstName: data.firstName,
          middleName: data.middleName,
          lastName: data.lastName,
          email,
          position: data.position,
          employeeType: "JO",
          division: getDivision(data.office),
          password: DEFAULT_PASSWORD,
          role: isAdmin ? adminRole._id : joRole._id,
          project: projectRecord._id,
          designation: designationId,
          status: "Active",
        });

        await employee.save();
        inserted++;
        console.log(
          `  ➕ Inserted: ${data.firstName} ${data.lastName} (${data.projectName}) [${employee.employeeId}]`,
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
    await mongoose.disconnect();
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error("❌ Error seeding JO employees:", error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
};

seedJoEmployees();
