import MyCtoCreditHistory from "../myCtoCreditComponent/myCtoCreditHistory";
import { CardFull, CardLg } from "../cardComponent";
const CtoCredits = () => {
  return (
    <div className=" w-[100%]  bg-neutral-200 flex gap-3 h-[calc(100vh-3.5rem)] md:h-[calc(100vh-3.5rem-1rem)]">
      <CardFull className="flex flex-col">
        <MyCtoCreditHistory />
      </CardFull>
    </div>
  );
};

export default CtoCredits;
