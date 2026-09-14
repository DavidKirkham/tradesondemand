import { evaluateServiceArea } from "./kc-metro";
import {
  isContractorStatus,
  validateContractorInput,
  type ContractorInput,
  type ContractorStatus,
  type ValidatedContractor,
} from "./contractor";
import { isPreferredContact, validateCustomerPatch, type PreferredContact } from "./customer";
import { isValidEmail } from "./phone";

export type AdminCustomerPatch = {
  name?: string;
  email?: string;
  phone?: string;
  preferredContact?: string;
};

export type AdminCustomerValidated = {
  name?: string;
  email?: string;
  phone?: string;
  preferredContact?: PreferredContact;
};

export function validateAdminCustomerPatch(
  input: AdminCustomerPatch,
): { ok: true; data: AdminCustomerValidated } | { ok: false; message: string } {
  const base = validateCustomerPatch({
    name: input.name,
    phone: input.phone,
    preferredContact: input.preferredContact,
  });
  if (!base.ok) return base;
  const data: AdminCustomerValidated = {};
  if (base.name) data.name = base.name;
  if (base.phone) data.phone = base.phone;
  if (base.preferredContact) data.preferredContact = base.preferredContact;
  if (input.email !== undefined) {
    if (!isValidEmail(input.email)) return { ok: false, message: "Enter a working email address." };
    data.email = input.email.trim().toLowerCase();
  }
  if (input.preferredContact !== undefined && !isPreferredContact(input.preferredContact)) {
    return { ok: false, message: "Preferred contact is phone or email." };
  }
  return { ok: true, data };
}

export type AdminContractorPatch = Omit<ContractorInput, "agreedToTerms"> & {
  status?: string;
  reviewNote?: string | null;
};

export type AdminContractorValidated = Omit<ValidatedContractor, "insured"> & {
  insured: boolean;
  status?: ContractorStatus;
  reviewNote: string | null;
};

export function validateAdminContractorPatch(
  input: AdminContractorPatch,
): { ok: true; data: AdminContractorValidated } | { ok: false; message: string; field?: string } {
  const result = validateContractorInput({
    ...input,
    insured: true,
    agreedToTerms: true,
  });
  if (!result.ok) return result;

  let status: ContractorStatus | undefined;
  if (input.status !== undefined && input.status !== "") {
    if (!isContractorStatus(input.status)) {
      return { ok: false, message: "Status must be pending, approved, or rejected." };
    }
    status = input.status;
  }

  return {
    ok: true,
    data: {
      ...result.data,
      insured: Boolean(input.insured),
      status,
      reviewNote: input.reviewNote?.trim() || null,
    },
  };
}

export function validateAdminBookingAddress(input: {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}):
  | { ok: true; street?: string; city?: string; state?: "MO" | "KS"; zip?: string }
  | { ok: false; message: string } {
  const hasAddress =
    input.street !== undefined ||
    input.city !== undefined ||
    input.state !== undefined ||
    input.zip !== undefined;
  if (!hasAddress) return { ok: true };

  const street = (input.street ?? "").trim();
  if (street.length < 4) {
    return { ok: false, message: "Add a street address so the tech can find the site." };
  }
  const area = evaluateServiceArea({
    zip: input.zip ?? "",
    city: input.city ?? "",
    state: input.state ?? "",
  });
  if (!area.ok) return { ok: false, message: area.message };
  return { ok: true, street, city: area.city, state: area.state, zip: area.zip };
}

export function searchNeedle(value?: string | null): string {
  return value?.trim() ?? "";
}

export function searchDigits(value: string): string {
  return value.replace(/\D/g, "");
}
