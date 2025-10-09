import AddCtoApplicationForm from "./ctoApplicationComponents/forms/addCtoApplicationForm";
import MyCtoApplications from "./ctoApplicationComponents/myCtoApplicationHistory";
import { CardFull } from "../cardComponent";
const CtoApplication = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <CardFull>
        <AddCtoApplicationForm />
      </CardFull>
      <CardFull>
        <MyCtoApplications />
      </CardFull>
    </div>
  );
};

export default CtoApplication;
