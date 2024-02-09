import crypto from "crypto";

import { ProjectMembershipRole, TProjectKeys } from "@app/db/schemas";

import { decryptAsymmetric, encryptAsymmetric } from "../crypto";

type AddUserToWsDTO = {
  decryptKey: TProjectKeys & { sender: { publicKey: string } };
  userPrivateKey: string;
  members: {
    orgMembershipId: string;
    projectMembershipRole: ProjectMembershipRole;
    userPublicKey: string;
  }[];
};

export const createWsMembers = ({ members, decryptKey, userPrivateKey }: AddUserToWsDTO) => {
  const key = decryptAsymmetric({
    ciphertext: decryptKey.encryptedKey,
    nonce: decryptKey.nonce,
    publicKey: decryptKey.sender.publicKey,
    privateKey: userPrivateKey
  });

  const newWsMembers = members.map(({ orgMembershipId, userPublicKey, projectMembershipRole }) => {
    const { ciphertext: inviteeCipherText, nonce: inviteeNonce } = encryptAsymmetric(
      key,
      userPublicKey,
      userPrivateKey
    );

    return {
      orgMembershipId,
      projectRole: projectMembershipRole,
      workspaceEncryptedKey: inviteeCipherText,
      workspaceEncryptedNonce: inviteeNonce
    };
  });

  return newWsMembers;
};

type TCreateProjectKeyDTO = {
  publicKey: string;
  privateKey: string;
};

export const createProjectKey = ({ publicKey, privateKey }: TCreateProjectKeyDTO) => {
  // 3. Create a random key that we'll use as the project key.
  const randomBytes = crypto.randomBytes(16).toString("hex");

  // 4. Encrypt the project key with the users key pair.
  const { ciphertext: encryptedProjectKey, nonce: encryptedProjectKeyIv } = encryptAsymmetric(
    randomBytes,
    publicKey,
    privateKey
  );

  return { key: encryptedProjectKey, iv: encryptedProjectKeyIv };
};