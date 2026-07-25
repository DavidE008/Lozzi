# ADR 0005: Envelope encryption for private objects

Status: Accepted

Each object receives a random data key and AES-256-GCM nonce. Ciphertext may be
stored in private object storage; the data key is wrapped by an external KMS
or equivalent and referenced by identifier. Wallet-recipient packages may use
ECIES. Plaintext and wrapped/decrypted keys never enter PostgreSQL, logs, Git,
analytics, or browser bundles.
