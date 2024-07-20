const StellarSdk = require("stellar-sdk");
const rpc_url = "https://soroban-testnet.stellar.org:443";

const server = new StellarSdk.SorobanRpc.Server(rpc_url, {
  allowHttp: true,
});

// Generate issuer and receiver keypairs
const issuerKeypair = StellarSdk.Keypair.random();
const receiverKeypair = StellarSdk.Keypair.random();

console.log(`Issuer Public Key: ${issuerKeypair.publicKey()}`);
console.log(`Issuer Secret Key: ${issuerKeypair.secret()}`);
console.log(`Receiver Public Key: ${receiverKeypair.publicKey()}`);
console.log(`Receiver Secret Key: ${receiverKeypair.secret()}`);

// Function to fund an account using Friendbot
async function fundAccount(keypair) {
  try {
    const friendbotUrl = `https://friendbot.stellar.org?addr=${keypair.publicKey()}`;
    const response = await fetch(friendbotUrl);

    if (response.ok) {
      console.log(`Account ${keypair.publicKey()} successfully funded.`);
    } else {
      console.error(
        `Something went wrong funding account: ${keypair.publicKey()}.`
      );
    }
  } catch (error) {
    console.error(`Error funding account ${keypair.publicKey()}: ${error}`);
  }
}

// Main function to fund accounts and create asset
async function main() {
  await Promise.all([issuerKeypair, receiverKeypair].map(fundAccount));

  try {
    const account = await server.getAccount(receiverKeypair.publicKey());

    let transaction = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET,
    })
      // Begin sponsoring future reserves
      .addOperation(
        StellarSdk.Operation.beginSponsoringFutureReserves({
          sponsoredId: receiverKeypair.publicKey(),
          source: issuerKeypair.publicKey(),
        })
      )
      // Add the NFT metadata to the issuer account using a `manageData` operation.
      .addOperation(
        StellarSdk.Operation.manageData({
          name: "ipfshash",
          value: "hash",
          source: issuerKeypair.publicKey(),
        })
      )
      // Perform a `changeTrust` operation to create a trustline for the receiver account.
      .addOperation(
        StellarSdk.Operation.changeTrust({
          asset: nftAsset,
          limit: "1",
          source: receiverKeypair.publicKey(),
        })
      )
      // Add a `payment` operation to send the NFT to the receiving account.
      .addOperation(
        StellarSdk.Operation.payment({
          destination: receiverKeypair.publicKey(),
          asset: nftAsset,
          amount: "1",
          source: issuerKeypair.publicKey(),
        })
      )
      // End sponsorship
      .addOperation(
        StellarSdk.Operation.endSponsoringFutureReserves({
          source: receiverKeypair.publicKey(),
        })
      )
      // Set a timeout and build the transaction
      .setTimeout(30)
      .build();

    // Sign the transaction
    transaction.sign(issuerKeypair);
    transaction.sign(receiverKeypair);

    // Submit the transaction
    await server.sendTransaction(transaction);
    console.log("The asset has been issued to the receiver");
  } catch (error) {
    console.error(`Error: ${error}`);
  }
}

// Run the main function
main().catch((error) => {
  console.error(`Error in main function: ${error}`);
});
