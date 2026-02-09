import AddCtoApplicationForm from "./ctoApplicationComponents/forms/addCtoApplicationForm";
import MyCtoApplications from "./ctoApplicationComponents/myCtoApplicationHistory";
import { CardFull, CardLg } from "../cardComponent";
const CtoApplication = () => {
  return (
    <div className=" w-[100%] flex gap-3 h-[calc(100vh-3.5rem-0.5rem)] md:h-[calc(100vh-3.5rem-1.5rem)]">
      <CardFull className="flex flex-col">
        <MyCtoApplications />
      </CardFull>
    </div>
  );
};

export default CtoApplication;
