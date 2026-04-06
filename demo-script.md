# LendPay Demo Script

## Goal

Show one truthful borrower flow:

1. analyze
2. request
3. approve
4. use funded balance in `viral_drop`
5. repay

## Runtime

- rollup: `lendpay-3`
- backend: `http://127.0.0.1:8080`
- frontend: `http://127.0.0.1:5173`

## Recording Order

1. Show the app homepage with the connected wallet and the single product story:
   `credit for Initia apps`
2. Open `Profile` and run `Re-analyze`.
3. Say the wallet now has a live score and a real limit.
4. Open `Request`.
5. Pick the live app: `Viral Drops`.
6. Pick one live drop so the amount syncs automatically.
7. Submit the request.
8. Show approval landing on the borrower flow.
9. Open `Repay`.
10. In `Use approved credit`, unlock the viral drop.
11. Point to the receipt state and explain:
    funded balance moved into the app and a receipt object was minted.
12. Repay the next installment.
13. Close by showing:
    stronger borrower history, onchain receipt, and repayment loop.

## Onchain Proof

Use these tx hashes if you want to mention verified chain execution:

- request: `9EF410304C9E6EA61906493E1712DCE952D2A3EA5BFB5F0D8D508EB97ACBFFFC`
- approve: `6F1079620F88C7E91B4507E09E92D1D96C690342294361A80246EC870A24E7D2`
- viral drop purchase: `5EC2DD5A4C4716EE4345921535EDB69B64B3234C15A3E954C04261268F6CA58E`
- first repay: `8D4C849B81521E0A1472B02139AC69E09563B267001A8755D86C2A0085CACF32`

## Verified End State

- request id: `1`
- loan id: `1`
- purchase id: `1`
- item id: `2`
- receipt object: `0x700360daca7f1c3688e0a872bc409290a0a9f409bfe541eac74579061f8e7b7f`
- total repaid: `300`
- viral drop payout balance: `300`
- final borrower points: `550`
