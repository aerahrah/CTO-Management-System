import AddCtoCreditForm from "./ctoCreditComponents/forms/addCtoCreditForm";
import CtoCreditHistory from "./ctoCreditComponents/recentCtoCreditHistory";
import { CardFull } from "../cardComponent";
const CtoCredits = () => {
  const handleFormSubmit = (data) => {
    console.log("Credit CTO submitted:", data);
  };

  return (
    <div className=" w-[100%] bg-neutral-200 flex gap-4 ">
      <CardFull>
        <AddCtoCreditForm onSubmit={handleFormSubmit} />
      </CardFull>
      <CardFull>
        <CtoCreditHistory />
      </CardFull>
    </div>
  );
};

export default CtoCredits;
