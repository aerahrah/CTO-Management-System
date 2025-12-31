import AddCtoApplicationForm from "./ctoApplicationComponents/forms/addCtoApplicationForm";
import MyCtoApplications from "./ctoApplicationComponents/myCtoApplicationHistory";
import { CardFull, CardLg } from "../cardComponent";
const CtoApplication = () => {
  return (
    <div className=" w-[100%] bg-neutral-200 flex gap-3 items-start">
      {/* <CardLg>
        <AddCtoApplicationForm />
      </CardLg> */}
      <CardFull>
        <MyCtoApplications />
      </CardFull>
    </div>
  );
};

export default CtoApplication;
