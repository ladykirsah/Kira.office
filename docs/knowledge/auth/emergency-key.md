# The owner's emergency key

*Owner's decision, 2026-08-26. Built the same day; migration `0090_owner_recovery_key.sql`.*

A **second** way back into Kira.office, standing beside the emailed Cloudflare Access code rather
than replacing it. The owner asked for both, and the reason they are both worth having is that they
fail differently: an emailed code proves you hold the mailbox, and is no use at all when Cloudflare
or that mailbox is itself the thing that is broken — which is the situation this guards against.

## What it is

A free-form secret the owner sets on their own profile — letters, numbers, symbols, Thai, anything
a keyboard types. Two steps to use it: press **ทางเข้าฉุกเฉิน** on the sign-in screen, type the key,
submit. No email, no account name.

## Why that shape is dangerous, and what holds it shut

It is typed ALONE, so it has to name the person as well as prove them — exactly the PIN's shape, and
therefore exactly the PIN's exposure: a form on the open internet that anybody may type into. A PIN
survives that because it is always six digits and the account locks after three misses. A free-form
key has neither guarantee by default.

Four things hold it shut, and the owner chose three of them:

| Guard | Value | Why |
|---|---|---|
| **Minimum length** | 4 characters | The owner asked for no minimum, heard what a one-character key means here, and set one themselves. It is the single biggest factor, so it lives in code (`recoveryKeyProblem`) rather than as a hint on a screen. |
| **Throttle** | 5 failures per caller per 15 minutes | Its own bucket, `staff-recovery:`, a quarter of the everyday door's twenty. The owner's rule was *slow them down, never lock* — this is the door for when you are ALREADY locked out, and a rescue a stranger can shut permanently is not a rescue. |
| **Role** | super admin alone | Checked at the door AND at the setter. One emergency key exists in the shop and it is the owner's. |
| **Storage** | peppered unique lookup + PBKDF2, and **no readable copy** | The one place it departs from the PIN. `pin_cipher` exists because the owner resets other people's PINs and must read them back; nobody ever needs to read this one, and a key that cannot be revealed cannot be revealed by anyone else either. |

## Three things that are easy to get wrong

**The account lock does not apply, in either direction.** A locked account is precisely what this
rescues, so the door opens through the lock and clears it on the way. And a wrong key must never add
a strike — three mistyped rescues would otherwise lock the everyday PIN as well, and the door would
take down the thing it exists to stand in for.

**One answer for every failure.** No key set, wrong key, wrong role, account switched off — all
return the same `invalid`, and the route echoes no `reason`. Anything else turns the door into an
oracle for whether an emergency key exists at all.

**It is written into the work history**, in red: `recovery_login`. An emergency sign-in is the one
event the owner must be able to find afterwards, whether or not it was them.

## Where the code is

- rule + lookup — `packages/core/src/staffPay.ts` (`recoveryKeyProblem`), `staffAuth.ts`
  (`recoveryLookup`, `canUseRecoveryKey`)
- the door — `apps/api/src/staffSession.ts` (`loginWithRecoveryKey`), route `/staff/login-recovery`
- setting one — `apps/api/src/staffRoutes.ts` (`setOwnRecoveryKey`, `clearOwnRecoveryKey`)
- throttle — `apps/api/src/loginThrottle.ts` (`recoveryThrottleKey`, `RECOVERY_MAX_FAILURES`)
- screens — `apps/admin/src/app/me/MyProfile.tsx`, `apps/admin/src/app/login/LoginForm.tsx`

See [access-model](access-model.md) and [staff-login-and-lockout](staff-login-and-lockout.md).
