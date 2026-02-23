import MyCtoApplications from "./ctoApplicationComponents/myCtoApplicationHistory";
import { CardFull } from "../cardComponent";

const CtoApplication = () => {
  return (
    <div className=" w-[100%] flex gap-3 h-[calc(100vh-3.5rem)] md:h-[calc(100vh-5rem)]">
      {/* ✅ Parent should NOT be scrollable on mobile */}
      <CardFull>
        <MyCtoApplications />
      </CardFull>
    </div>
  );
};

export default CtoApplication;
