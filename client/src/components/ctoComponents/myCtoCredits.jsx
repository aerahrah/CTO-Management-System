import MyCtoCreditHistory from "../myCtoCreditComponent/myCtoCreditHistory";
import { CardFull, CardLg } from "../cardComponent";
const MyCtoCredits = () => {
  return (
    <div className=" w-[100%] flex gap-3 h-[calc(100vh-3.5rem-0.5rem)] md:h-[calc(100vh-3.5rem-1.5rem)]">
      <CardFull className="flex flex-col">
        <MyCtoCreditHistory />
      </CardFull>
    </div>
  );
};

export default MyCtoCredits;
