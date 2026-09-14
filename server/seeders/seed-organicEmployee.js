const mongoose = require("mongoose");
require("dotenv").config();

const Employee = require("../models/Employee");
const Designation = require("../models/Designation");
const Role = require("../models/Role");
const Project = require("../models/Project");

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
    firstName: "CIRILO JR.",
    middleName: "NACINO",
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
    position: "Admin Aide IV./Driver II",
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

const getDivision = (officeString) => {
  const lowerOffice = officeString.toLowerCase();
  if (lowerOffice.includes("administrative and finance")) return "AFD";
  if (lowerOffice.includes("regional director")) return "ORD";
  return "TOD"; // Defaults Provincial Offices and Technical Operations to TOD
};

const seedEmployees = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");
    console.log("⏳ Seeding Organic Employees...");

    // 1. Fetch the "regular" role for organic employees
    const regularRole = await Role.findOne({ name: "regular" });
    if (!regularRole) {
      throw new Error(
        "❌ 'regular' role not found! Run your Role seeder first.",
      );
    }

    // 2. Fetch or Create an "N/A" project so Mongoose validation passes
    let naProject = await Project.findOne({ name: "N/A" });
    if (!naProject) {
      naProject = await Project.create({ name: "N/A", status: "Active" });
      console.log("  📌 Created 'N/A' Project dynamically.");
    }

    // 3. Map all designations for quick ID lookup
    const designations = await Designation.find({});
    const designationMap = designations.reduce((acc, des) => {
      acc[des.name] = des._id;
      return acc;
    }, {});

    let count = 1;

    // 4. Save employees using .save() to trigger bcrypt password hashing
    for (const data of employeesToSeed) {
      let employee = await Employee.findOne({ email: data.email });

      if (!employee) {
        const designationId = designationMap[data.designationName];

        employee = new Employee({
          employeeId: `DICT-${String(count).padStart(3, "0")}`,
          firstName: data.firstName,
          middleName: data.middleName,
          lastName: data.lastName,
          email: data.email,
          position: data.position,
          employeeType: "Organic", // Hardcoded as requested
          division: getDivision(data.office),
          password: "Password@2026!", // Will be hashed securely
          role: regularRole._id, // References the "regular" role
          project: naProject._id, // References the "N/A" project
          designation: designationId || null,
          status: "Active",
        });

        await employee.save();
        console.log(`  ➕ Inserted: ${data.firstName} ${data.lastName}`);
      } else {
        console.log(`  ⏩ Skipped: ${data.email} (Already exists)`);
      }
      count++;
    }

    console.log("\n✅ Organic Employees seeded successfully!");
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding employees:", error);
    process.exit(1);
  }
};

seedEmployees();
