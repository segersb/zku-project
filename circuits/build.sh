#!/bin/bash -e
set -e

if [ -f ./build/powersOfTau28_hez_final_16.ptau ]; then
    echo "powersOfTau28_hez_final_16.ptau already exists. Skipping."
else
    echo 'Downloading powersOfTau28_hez_final_16.ptau'
    wget -P ./build https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_16.ptau
fi

echo "Compiling utilityClaim.circom..."
circom ./src/utilityClaim.circom --r1cs --wasm --sym -o ./build
snarkjs r1cs info ./build/utilityClaim.r1cs
snarkjs groth16 setup ./build/utilityClaim.r1cs ./build/powersOfTau28_hez_final_16.ptau ./build/utilityClaim_0000.zkey
snarkjs zkey contribute ./build/utilityClaim_0000.zkey ./build/utilityClaim_final.zkey --name="1st Contributor Name" -v -e="utilityClaim"
snarkjs zkey export verificationkey ./build/utilityClaim_final.zkey ./build/utilityClaim_verification_key.json
snarkjs zkey export solidityverifier ./build/utilityClaim_final.zkey ./build/utilityClaimVerifier.sol