import CtoCreditHistory from "./ctoCreditComponents/recentCtoCreditHistory";
import { CardFull, CardLg } from "../cardComponent";
const CtoCredits = () => {
  return (
    <div className=" w-[100%] flex gap-3 h-[calc(100vh-3.5rem-0.5rem)] md:h-[calc(100vh-5rem)]">
      <CardFull className="flex flex-col">
        <CtoCreditHistory />
      </CardFull>
    </div>
  );
};

export default CtoCredits;
