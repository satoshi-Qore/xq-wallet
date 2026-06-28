# Vault Persistence Architecture

> Status: Approved Architecture  
> Version: 1.0  
> XQ Wallet Engineering Documentation

## Overview

The Vault Persistence subsystem is responsible for securely storing encrypted wallet vaults while maintaining a strict separation between cryptography, storage, and application logic.

The persistence layer never stores decrypted wallet state, passwords, mnemonic phrases, seed phrases, or private keys.

## Design Goals

### Secure Persistence

Only encrypted vault data may be persisted. No secret material is ever written to storage.

### Storage Independence

The application must not depend directly on a specific storage backend. IndexedDB is the initial target, but the architecture allows future adapters.

### Clean Architecture

Persistence is implemented behind ports and adapters. Domain logic does not depend on browser APIs.

### Offline First

The vault must remain usable without network connectivity.

### Future Compatibility

Schema versioning and migration support are included from the beginning.

## Clean Architecture

```text
Application Layer
        ↓
Vault Persistence Service
        ↓
Vault Storage Adapter
        ↓
IndexedDB Adapter
        ↓
IndexedDB
```
