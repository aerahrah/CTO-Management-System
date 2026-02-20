import MyCtoApplications from "./ctoApplicationComponents/myCtoApplicationHistory";
import { CardFull } from "../cardComponent";

const CtoApplication = () => {
  return (
    <div className="w-full flex gap-3 h-[calc(100dvh-3.5rem)] md:h-[calc(100vh-3.5rem-1.5rem)] min-h-0 overflow-hidden">
      {/* ✅ Parent should NOT be scrollable on mobile */}
      <CardFull className="flex flex-col flex-1 min-h-0 h-full overflow-hidden">
        <MyCtoApplications />
      </CardFull>
    </div>
  );
};

export default CtoApplication;
