import AddCtoApplicationForm from "./ctoApplicationComponents/forms/addCtoApplicationForm";
import MyCtoApplications from "./ctoApplicationComponents/myCtoApplicationHistory";
import { CardFull, CardLg } from "../cardComponent";
const CtoApplication = () => {
  return (
    <div className=" w-[100%]  bg-neutral-200 flex gap-3 min-h-[calc(100vh-4rem-1.5rem)]">
      <CardFull className="flex flex-col">
        <MyCtoApplications />
      </CardFull>
    </div>
  );
};

export default CtoApplication;
