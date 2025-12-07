import AddCtoApplicationForm from "./ctoApplicationComponents/forms/addCtoApplicationForm";
import MyCtoApplications from "./ctoApplicationComponents/myCtoApplicationHistory";
import { CardFull } from "../cardComponent";
const CtoApplication = () => {
  return (
    <div className=" w-[100%] bg-neutral-200 flex gap-4 ">
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
