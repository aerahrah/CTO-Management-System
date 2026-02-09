import AllCtoApplicationsHistory from "./ctoApplicationComponents/allCtoApplicationHistory";
import { CardFull, CardLg } from "../cardComponent";
const AllCtoApplications = () => {
  return (
    <div className=" w-[100%] flex gap-3 h-[calc(100vh-3.5rem-0.5rem)] md:h-[calc(100vh-3.5rem-1.5rem)]">
      <CardFull className="flex flex-col">
        <AllCtoApplicationsHistory />
      </CardFull>
    </div>
  );
};

export default AllCtoApplications;
