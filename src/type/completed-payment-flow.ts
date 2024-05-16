import JoinForm from "@models/JoinForm";

export interface CompletedPaymentFlow {
  joinForm: JoinForm;
  customerId: string;
  mandateId: string;
}
