export type TermsStatus = "DRAFT" | "ACTIVE" | "RETIRED";

export type TermsVersionRecord = {
  id: string;
  version: string;
  title: string;
  body: string;
  status: TermsStatus;
  publishedAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateTermsVersionInput = {
  version: string;
  title: string;
  body: string;
  status: TermsStatus;
  createdBy: string;
};

export type PublishTermsVersionInput = {
  id: string;
  publishedAt: Date;
};

export interface TermsRepository {
  create(input: CreateTermsVersionInput): Promise<TermsVersionRecord>;
  findById(id: string): Promise<TermsVersionRecord | null>;
  findActive(): Promise<TermsVersionRecord | null>;
  listAll(): Promise<TermsVersionRecord[]>;
  publish(input: PublishTermsVersionInput): Promise<TermsVersionRecord>;
}
