const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

// Resolve the absolute path to the .env file in the parent directory
require("../config/loadEnv");
// Adjust this path if your model is named differently
const SalaryGrade = require("../models/salaryGradeModel");

// ---------------------------------------------------------------------
// EXACT SALARY MATRIX (Based on Official Document)
// ---------------------------------------------------------------------
const exactSalaryMatrix = [
  /* SG 1  */ [14634, 14730, 14849, 14968, 15089, 15211, 15333, 15456],
  /* SG 2  */ [15522, 15636, 15752, 15869, 15986, 16103, 16223, 16342],
  /* SG 3  */ [16486, 16610, 16732, 16856, 16982, 17106, 17234, 17360],
  /* SG 4  */ [17506, 17636, 17767, 17898, 18031, 18163, 18298, 18433],
  /* SG 5  */ [18581, 18720, 18858, 18998, 19137, 19280, 19423, 19565],
  /* SG 6  */ [19716, 19862, 20009, 20158, 20307, 20456, 20609, 20761],
  /* SG 7  */ [20914, 21069, 21224, 21382, 21539, 21699, 21859, 22022],
  /* SG 8  */ [22423, 22627, 22832, 23038, 23246, 23456, 23668, 23883],
  /* SG 9  */ [24329, 24523, 24720, 24917, 25117, 25318, 25521, 25725],
  /* SG 10 */ [26917, 27131, 27347, 27565, 27786, 28007, 28230, 28456],
  /* SG 11 */ [31705, 31820, 32109, 32401, 32697, 32998, 33302, 33611],
  /* SG 12 */ [33947, 34069, 34357, 34648, 34943, 35242, 35544, 35850],
  /* SG 13 */ [36125, 36283, 36599, 36919, 37244, 37572, 37904, 38241],
  /* SG 14 */ [38764, 39141, 39523, 39910, 40300, 40696, 41097, 41503],
  /* SG 15 */ [42178, 42594, 43015, 43442, 43874, 44310, 44753, 45202],
  /* SG 16 */ [45694, 46152, 46615, 47084, 47559, 48040, 48528, 49020],
  /* SG 17 */ [49562, 50066, 50576, 51092, 51614, 52144, 52678, 53221],
  /* SG 18 */ [53818, 54371, 54933, 55499, 56075, 56657, 57246, 57842],
  /* SG 19 */ [59153, 59966, 60793, 61632, 62486, 63353, 64236, 65132],
  /* SG 20 */ [66052, 66970, 67904, 68853, 69818, 70772, 71727, 72671],
  /* SG 21 */ [73303, 74337, 75388, 76456, 77542, 78645, 79692, 80831],
  /* SG 22 */ [81796, 82963, 84151, 85356, 86582, 87746, 89011, 90295],
  /* SG 23 */ [91306, 92622, 93962, 95330, 96823, 98341, 99883, 101318],
  /* SG 24 */ [102603, 104209, 105841, 107500, 109185, 110898, 112533, 114301],
  /* SG 25 */ [116643, 118469, 120326, 122212, 124131, 126079, 128061, 130073],
  /* SG 26 */ [131807, 133870, 135968, 138100, 140268, 142469, 144707, 146983],
  /* SG 27 */ [148940, 151273, 153644, 155906, 158353, 160235, 162752, 165310],
  /* SG 28 */ [167129, 169752, 172418, 174797, 177545, 180339, 182660, 185537],
  /* SG 29 */ [187531, 190482, 193480, 196528, 199624, 202005, 205191, 208430],
  /* SG 30 */ [210718, 214038, 217207, 220425, 223691, 227224, 230595, 234240],
  /* SG 31 */ [300961, 306691, 312532, 318182, 323938, 329989, 336092, 342310],
  /* SG 32 */ [356237, 363257, 370418, 377359, 384805, 392400, 400150, 408055],
  /* SG 33 */ [449157, 462329], // Note: SG 33 only goes up to Step 2
];

const seedSalaryGrades = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");
    console.log("⏳ Seeding EXACT Salary Grades based on official document...");

    let count = 0;

    // Iterate over the matrix rows
    for (
      let gradeIndex = 0;
      gradeIndex < exactSalaryMatrix.length;
      gradeIndex++
    ) {
      const gradeNumber = gradeIndex + 1;
      const stepsArray = exactSalaryMatrix[gradeIndex];

      // Iterate over the available steps in the current Salary Grade array
      for (let stepIndex = 0; stepIndex < stepsArray.length; stepIndex++) {
        const stepNumber = stepIndex + 1;
        const exactAmount = stepsArray[stepIndex];

        // Upsert prevents duplicates by checking { grade, step }
        await SalaryGrade.findOneAndUpdate(
          { grade: gradeNumber, step: stepNumber },
          {
            $set: { grade: gradeNumber, step: stepNumber, amount: exactAmount },
          },
          { upsert: true, new: true, runValidators: true },
        );

        count++;
      }
    }

    console.log(`✅ Successfully seeded ${count} exact Salary Grade records!`);

    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding salary grades:", error);
    process.exit(1);
  }
};

seedSalaryGrades();
