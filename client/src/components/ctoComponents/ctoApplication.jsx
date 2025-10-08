import AddCtoApplicationForm from "./ctoApplicationComponents/forms/addCtoApplicationForm";
import CtoCreditHistory from "./ctoCreditComponents/recentCtoCreditHistory";
import { CardFull } from "../cardComponent";
const CtoApplication = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <CardFull height="150">
        <AddCtoApplicationForm />
      </CardFull>
      <CardFull height="150">
        <CtoCreditHistory />
      </CardFull>
    </div>
  );
};

export default CtoApplication;
