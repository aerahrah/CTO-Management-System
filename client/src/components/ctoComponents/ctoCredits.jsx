import CtoCreditHistory from "./ctoCreditComponents/recentCtoCreditHistory";
import { CardFull, CardLg } from "../cardComponent";
const CtoCredits = () => {
  return (
    <div className=" w-[100%] bg-neutral-200 flex gap-3 ">
      <CardFull>
        <CtoCreditHistory />
      </CardFull>
    </div>
  );
};

export default CtoCredits;
