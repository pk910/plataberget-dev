# Platåberget Testnet Developer Portal

This repository contains the source code for [plataberget.dev](https://plataberget.dev), the developer portal for the Platåberget Ethereum testnet.

## About Platåberget

Platåberget is the public Gloas testnet (internally known as `glamsterdam-devnet-8`). It lets users test the new Gloas / Glamsterdam features — enshrined proposer-builder separation (ePBS), block-level access lists, gas repricing and more — and update their projects before the upgrade reaches the public testnets and mainnet.

The validator set is open: everyone is invited to run a test node and deposit test validators.

- **Chain ID:** 7091047534
- **Launch Date:** August 13, 2026 (12:00 UTC)
- **Gloas Fork:** epoch 1536 — August 20, 2026 07:50:24 UTC
- **EOL:** when Glamsterdam ships on mainnet

## Local Development

This is a static website with no build step required. To run locally:

```bash
# Using Python
python3 -m http.server 8000

# Using Node.js
npx serve .

# Or simply open index.html in your browser
```

Then open `http://localhost:8000` in your browser.

To update the `dist/` directory used for deployment:

```bash
npm run build
```

## Contributing

Contributions are welcome! If you'd like to add resources, fix bugs, or improve the site:

1. Fork this repository
2. Create a feature branch (`git checkout -b add-new-resource`)
3. Make your changes
4. Submit a pull request

### Adding Resources

Resources are organized in `index.html` under the Resources section. Common additions include:

- **RPC Endpoints** - Public JSON-RPC providers
- **Checkpoint Sync Providers** - Beacon chain checkpoint sync URLs
- **Block Explorers** - EL and CL explorers
- **Faucets** - Testnet ETH faucets

### Project Structure

```
plataberget-dev/
├── index.html      # Main page
├── css/
│   └── style.css   # Styles
├── js/
│   ├── config.js   # Network configuration
│   └── main.js     # Application logic
└── img/            # Images and logos
```

## Related Links

- [Platåberget Spec Notes](https://notes.ethereum.org/@ethpandaops/glamsterdam-devnet-8) - EIP list, client images, and testing focus
- [glamsterdam-devnets](https://github.com/ethpandaops/glamsterdam-devnets) - Network configuration and infrastructure code
- [Network Configs](https://github.com/ethpandaops/glamsterdam-devnets/tree/master/network-configs/devnet-8/metadata) - config.yaml, genesis.json, bootstrap nodes

## License

This project is open source and available under the [MIT License](LICENSE).
