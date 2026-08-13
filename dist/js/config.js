const PLATABERGET_CONFIG = {
    // API configuration (Dora explorer API)
    api: {
        baseUrl: 'https://dora.plataberget.ethpandaops.io/api/v1',
        token: '',
        endpoints: {
            overview: '/network/overview',
            splits: '/network/splits',
            epochs: '/epochs?limit=5'
        }
    },

    network: {
        name: 'Platåberget Testnet',
        chainId: 7091047534,
        networkId: 7091047534,
        launchDate: '2026-08-13',
        launchTimestamp: 1786622400,
        consensus: 'Proof of Stake',
        eol: 'When Glamsterdam ships on mainnet'
    },

    // Forks ordered by activation time
    // Each fork has: name, timestamp (null = at genesis), elVersion, clVersion
    forks: [
        {
            name: 'Genesis (Merge → Fusaka)',
            timestamp: null, // At genesis
            epoch: 0,
            elVersion: 'Osaka',
            clVersion: 'Fulu',
            isGenesis: true
        },
        {
            name: 'Glamsterdam (Amsterdam/Gloas)',
            timestamp: 1787212224,
            epoch: 1536,
            elVersion: 'Amsterdam',
            clVersion: 'Gloas'
        }
    ],

    // Scheduled events that are not consensus forks (appended to the fork
    // timeline even when live fork data is available)
    extraEvents: [
        {
            name: '200M Gas Limit (EIP-8261)',
            timestamp: 1787223744,
            epoch: 1566,
            elVersion: null,
            clVersion: null
        }
    ],

    // MetaMask configuration
    metamask: {
        chainId: '0x1A6A8CC6E', // 7091047534 in hex
        chainName: 'Platåberget Testnet',
        nativeCurrency: {
            name: 'Platåberget Ether',
            symbol: 'ETH',
            decimals: 18
        },
        rpcUrls: ['https://rpc.plataberget.ethpandaops.io'],
        blockExplorerUrls: ['https://dora.plataberget.ethpandaops.io']
    }
};
