import MyCtoCreditHistory from "../myCtoCreditComponent/myCtoCreditHistory";
import { CardFull, CardLg } from "../cardComponent";
const CtoCredits = () => {
  return (
    <div className=" w-[100%]  bg-neutral-200 flex gap-3 min-h-[calc(100vh-4rem-1.5rem)]">
      <CardFull className="flex flex-col">
        <MyCtoCreditHistory />
      </CardFull>
    </div>
  );
};

export default CtoCredits;
