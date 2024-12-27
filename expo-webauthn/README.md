# agora-expo-passkeys

Opinionated passkeys/webauthn interface for Expo apps that use passkeys for
authentication using the private/public keypairs directly rather than using them
for server authentication/login.

This means we make some choices that do not follow the WebAuthn spec
recommendations. For example,

- The challenges are not random server-generated strings, but rather will be
  deterministic based on the message we want the user to sign. This means for a
  wallet application like Nosh, these will be transaction hashes.
- We do not follow the recommendation that user IDs should be random/uncorrelated
  with the user's identity. Instead, we use a base-64 encoded username as the user
  ID. This is fine for our use case as described on [Stackoverflow](https://stackoverflow.com/a/76663224). Note that the keys are already publicly associated with the user's identity (as both their account address/name and the key are public on the blockchain).
- We return and use a simplified interface to requests and responses, rather than
  the full WebAuthn spec.

Recommended readings:

- [Webauthn Guide](https://webauthn.guide)
- [Webauthn Spec](https://w3c.github.io/webauthn/)
- [Yubico's WebAuthn Developer Guide](https://developers.yubico.com/WebAuthn/WebAuthn_Developer_Guide/)

## Running the app locally on Android

Android requires a signed APK linked to an origin via an `assetlinks.json` file. Follow [these instructions](https://coderwall.com/p/r09hoq/android-generate-release-debug-keystores) and reference your debug keystore from you `eas.json` file:

```json
"android":  {
    "buildType": "apk",
    "credentialsSource": "local"
}
```

To generate a _shared_ `debug.keystore` to avoid this complexity for each new collaborator, you can run:

```sh
keytool -list -v -keystore debug.keystore -alias androiddebugkey -storepass android
```

and commit the file.

The above `eas.json` section references "local" credentials and will look for a "credentials.json" file. Create a file called `credetials.json` in the root of your react-native / expo app with a keystore path that references either your own personal android keystore, or a shared keystore from the repository.

```
{
    "android": {
      "keystore": {
        "keystorePath": "/Users/perhats/.android/debug.keystore",
        "keystorePassword": "android",
        "keyAlias": "androiddebugkey",
        "keyPassword": "android"
      }
    }
}
```

This is "okay" to commit to git given it's only a local debug store without any value and does not pose any security risk.

Finally, you need to grab your certificate's sha256 fingerprint and associate it with your apps domain by hosting a new file at `/.well-known/assetlinks.json`. For an example you can view the file structure at [here](https://github.com/Mperhats/mperhats.github.io).

If your keystore lives in the repository, verify your keystore and fetch your certificate fingerprint by navigating to the root of the repo (in our case /apps/customer-native) and running:

```sh
cd apps/customer-native
keytool -list -v -keystore debug.keystore -alias androiddebugkey -storepass android
```

If you are running this process for the first time and want to use your default android keystore for app signing, you can get your certificate fingerprint with:

```sh
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.palettelabs.nosh.development",
      "sha256_cert_fingerprints": [
        "59:10:F8:30:B7:39:95:7F:41:38:92:6C:F5:91:31:6C:2B:34:09:C8:3F:7D:6F:FB:4C:DF:64:11:F7:20:94:5E"
      ]
    }
  }
]
```

After you host this file, you can verify that it contains the `sha256_cert_fingerprints` from your android keystore by running:

```sh
curl https://dev.noshdelivery.xyz/.well-known/assetlinks.json
```

After you host the `/.well-known/assetlinks.json` file at the custom domain, you need to establish the associated domain in your `app.config.ts`

```ts
android: {
  intentFilters: [
    {
      action: 'VIEW',
      autoVerify: true,
      data: [
        {
          scheme: 'https',
          host: 'dev.noshdelivery.xyz',
        },
      ],
      category: ['BROWSABLE', 'DEFAULT'],
    },
  ]
}
```

In the `packages/agora-mobile-signer-utils/src/logic/passkey.ts` package, you can hardcode the hostname for testing (not this should be a temporary hack to test locally signed apks) (TODO-AGORA: could improve dx here with a util?)

```ts
const result = await Log.retryBackoff(
  'ExpoPasskeysCreate',
  () =>
    ExpoPasskeys.createPasskey({
      domain: env(agoraChain).passkeyDomain, // replace w/ hardcoded https host of /.well-known/assetlinks.json` file
      passkeyName,
      passkeyDisplayTitle,
      challengeB64,
      useSecurityKey,
    }),
  5,
  matchAASABugError,
  AASA_BUG_MESSAGE
)
```

### Expo build & run recipes

- `eas build --platform android --local --profile development-simulator` produces an APK file
- If you are testing on a real device, enable [developer mode](https://developer.android.com/studio/debug/dev-options) and pair your device with Android Studio (see [this](https://developer.android.com/studio/run/device#wireless)) to get debug logs via [LogCat](https://developer.android.com/studio/debug/logcat). That's really helpful to figure out what's going on.

- If you are testing on a simulator you need to log into a Google account on the simulator and configure PIN encryption to test passkey functionality. A good test to see if your simulator is set up correctly: visit https://webauthn.io from the Chrome browser and try to sign up / sign in with a passkey before testing your APK
- Once you have your simulator or real device ready, install your APK with `adb`:

/Users/perhats/Documents/GitHub/nosh/apps/customer-native/build-1721669492084.apk

```sh
adb devices -l
List of devices attached
adb-27131JEGR40336-UUo6mJ._adb-tls-connect._tcp. device product:bluejay model:Pixel_6a device:bluejay transport_id:3
emulator-5554          device product:sdk_gphone64_arm64 model:sdk_gphone64_arm64 device:emu64a transport_id:2

# The output provides information about each connected device/emulator, including the transport ID (transport_id). You can target the installation of the apk file by the transport id like:
adb -s emulator-5554 install /path/to/your/app.apk
```

Note: a more convenient option if you're simply looking to run debug mode for your app: `npx expo run:android -d` will yield a dropdown of available devices and run your app in debug mode! But be careful: **this doesn't work to test passkey functionality because the app won't be signed**.

### Common Errors.

- The errors from android credential manager are notoriously shit. When testing, I continued to receive the error `the incoming request cannot be validated`. If you receive this error, it's likely because associated domains and app signing were not properly configured.

### TODO

- [ ] improve error handling. Android errors are a bit cryptic. Should add typescript methods for the module that display more human readable error messages. Can draw inspo from [here](https://github.com/f-23/react-native-passkey)
