import { z } from "zod";

import { SecretKeyEncoding, TProjectKeys } from "@app/db/schemas";

import { decryptAsymmetric, decryptSymmetric } from "../crypto";
import { decryptSymmetric128BitHexKeyUTF8, TDecryptSymmetricInput } from "../crypto/encryption";

export enum SecretDocType {
  Secret = "secret",
  SecretVersion = "secretVersion",
  ApprovalSecret = "approvalSecret"
}

const PartialSecretSchema = z.object({
  id: z.string(),
  secretKeyCiphertext: z.string(),
  secretKeyIV: z.string(),
  secretKeyTag: z.string(),

  secretValueCiphertext: z.string(),
  secretValueIV: z.string(),
  secretValueTag: z.string(),

  secretCommentCiphertext: z.string().nullish(),
  secretCommentIV: z.string().nullish(),
  secretCommentTag: z.string().nullish(),

  docType: z.nativeEnum(SecretDocType),

  keyEncoding: z.string()
});

const PartialDecryptedSecretSchema = z.object({
  id: z.string(),
  secretKey: z.string(),
  secretValue: z.string(),
  secretComment: z.string().optional(),

  docType: z.nativeEnum(SecretDocType)
});

export type TPartialSecret = z.infer<typeof PartialSecretSchema>;
export type TPartialDecryptedSecret = z.infer<typeof PartialDecryptedSecretSchema>;

const symmetricDecrypt = ({
  keyEncoding,
  ciphertext,
  tag,
  iv,
  key,
  isApprovalSecret
}: TDecryptSymmetricInput & { keyEncoding: SecretKeyEncoding; isApprovalSecret: boolean }) => {
  if (keyEncoding === SecretKeyEncoding.UTF8 || isApprovalSecret) {
    const data = decryptSymmetric128BitHexKeyUTF8({ key, iv, tag, ciphertext });
    return data;
  }
  if (keyEncoding === SecretKeyEncoding.BASE64) {
    const data = decryptSymmetric({ key, iv, tag, ciphertext });
    return data;
  }

  throw new Error("Missing both encryption keys");
};

export const decryptSecrets = (
  encryptedSecrets: TPartialSecret[],
  privateKey: string,
  latestKey: TProjectKeys & {
    sender: {
      publicKey: string;
    };
  }
) => {
  const key = decryptAsymmetric({
    ciphertext: latestKey.encryptedKey,
    nonce: latestKey.nonce,
    publicKey: latestKey.sender.publicKey,
    privateKey
  });

  const secrets: TPartialDecryptedSecret[] = [];

  encryptedSecrets.forEach((encSecret) => {
    const secretKey = symmetricDecrypt({
      ciphertext: encSecret.secretKeyCiphertext,
      iv: encSecret.secretKeyIV,
      tag: encSecret.secretKeyTag,
      key,
      keyEncoding: encSecret.keyEncoding as SecretKeyEncoding,
      isApprovalSecret: encSecret.docType === SecretDocType.ApprovalSecret
    });

    const secretValue = symmetricDecrypt({
      ciphertext: encSecret.secretValueCiphertext,
      iv: encSecret.secretValueIV,
      tag: encSecret.secretValueTag,
      key,
      keyEncoding: encSecret.keyEncoding as SecretKeyEncoding,
      isApprovalSecret: encSecret.docType === SecretDocType.ApprovalSecret
    });

    const secretComment =
      encSecret.secretCommentCiphertext && encSecret.secretCommentIV && encSecret.secretCommentTag
        ? symmetricDecrypt({
            ciphertext: encSecret.secretCommentCiphertext,
            iv: encSecret.secretCommentIV,
            tag: encSecret.secretCommentTag,
            key,
            keyEncoding: encSecret.keyEncoding as SecretKeyEncoding,
            isApprovalSecret: encSecret.docType === SecretDocType.ApprovalSecret
          })
        : "";

    const decryptedSecret: TPartialDecryptedSecret = {
      id: encSecret.id,
      secretKey,
      secretValue,
      secretComment,
      docType: encSecret.docType
    };

    secrets.push(decryptedSecret);
  });

  return secrets;
};