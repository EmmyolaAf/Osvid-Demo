/**
 * Client Installation Configuration
 * Defines the stable identity and provider-governance metadata for this installation.
 * 
 * Architecture:
 * - Current OSVID installation is an isolated client data plane.
 * - Future provider control plane connects using this clientId without restructuring business collections.
 */

export interface ClientInstallationConfig {
  clientId: string;
  clientName: string;
  businessName: string;
  defaultAdminEmail: string;
  primaryDomain: string;
  firebaseProjectId: string;
  version: string;
  plan: string;
  controlPlaneReady: boolean;
}

export const OSVID_CLIENT_CONFIG: ClientInstallationConfig = {
  clientId: "osvid",
  clientName: "OSVID Chemicals Limited",
  businessName: "OSVID Chemicals",
  defaultAdminEmail: "admin@osvidchemicals.com",
  primaryDomain: "osvidchemicals.com",
  firebaseProjectId: "osvid-production",
  plan: "Dedicated Enterprise",
  version: "2.0.0",
  controlPlaneReady: true,
};
