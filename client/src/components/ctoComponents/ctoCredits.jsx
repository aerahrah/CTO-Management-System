import AddCtoCreditForm from "./ctoCreditComponents/forms/addCtoCreditForm";
import CtoCreditHistory from "./ctoCreditComponents/recentCtoCreditHistory";
import { CardFull, CardLg } from "../cardComponent";
const CtoCredits = () => {
  const handleFormSubmit = (data) => {
    console.log("Credit CTO submitted:", data);
  };

  return (
    <div className=" w-[100%] bg-neutral-200 flex gap-4 ">
      <CardLg>
        <AddCtoCreditForm onSubmit={handleFormSubmit} />
      </CardLg>
      <CardFull>
        <CtoCreditHistory />
      </CardFull>
    </div>
  );
};

export default CtoCredits;
