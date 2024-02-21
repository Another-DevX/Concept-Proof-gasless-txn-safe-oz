'use client';
import {
  SafeAuthPack,
  SafeAuthConfig,
  SafeAuthInitOptions,
  SafeAuthUserInfo,
  AuthKitSignInData,
} from '@safe-global/auth-kit';
import { Contract, ethers, BigNumber } from 'ethers';
import { useEffect, useState } from 'react';
import forwarderABI from '@/assets/Forwarder.abi.json';
import counterABI from '@/assets/Counter.abi.json';

const EIP712Domain = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' },
];

const ForwardRequest = [
  { name: 'from', type: 'address' },
  { name: 'to', type: 'address' },
  { name: 'value', type: 'uint256' },
  { name: 'gas', type: 'uint256' },
  { name: 'nonce', type: 'uint256' },
  { name: 'deadline', type: 'uint48' },
  { name: 'data', type: 'bytes' },
];

function getMetaTxTypeData(chainId: string, verifyingContract: string) {
  console.debug('getMetaTxTypeData', chainId, verifyingContract);
  return {
    types: {
      EIP712Domain,
      ForwardRequest,
    },
    domain: {
      name: 'ConceptProof',
      version: '1',
      chainId,
      verifyingContract,
    },
    primaryType: 'ForwardRequest',
  };
}

async function buildRequest(forwarder: Contract, input: any) {
  const nonce = await forwarder
    .nonces(input.from)
    .then((nonce: number) => nonce.toString());
  const deadline = BigNumber.from(1740152697).toString();
  return { value: 0, gas: 1e6, deadline, nonce, ...input };
}

async function buildTypedData(forwarder: any, request: any) {
  const chainId = '11155111';
  const typeData = getMetaTxTypeData(
    chainId,
    '0x52c84c6aa1e19f311fd9ad5f227fe593852b0c03'
  );
  return { ...typeData, message: request };
}

async function signMetaTxRequest(
  signer: ethers.providers.JsonRpcSigner,
  forwarder: any,
  input: any
) {
  const request = await buildRequest(forwarder, input);
  const toSign = await buildTypedData(forwarder, request);
  console.debug(
    toSign.domain,
    { ForwardRequest: toSign.types.ForwardRequest },
    toSign.message
  );
  const signature = await signer._signTypedData(
    toSign.domain,
    { ForwardRequest: toSign.types.ForwardRequest },
    toSign.message
  );
  return { signature, request };
}

export default function Home() {
  const [authPack, setAuthPack] = useState<SafeAuthPack | null>(null);
  const [count, setCount] = useState('0');
  const [chainId, setChainId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [safeAuthSignInResponse, setSafeAuthSignInResponse] =
    useState<AuthKitSignInData | null>(null);
  const [provider, setProvider] =
    useState<ethers.providers.Web3Provider | null>(null);
  const [balance, setBalance] = useState('');
  const [userInfo, setUserInfo] = useState<SafeAuthUserInfo | null>(null);
  useEffect(() => {
    const safeAuthInitOptions: SafeAuthInitOptions = {
      enableLogging: true,
      showWidgetButton: true,
      chainConfig: {
        chainId: '0xaa36a7',
        rpcTarget: `https://ethereum-sepolia.publicnode.com`,
      },
    };
    async function initSafeAuth() {
      const safeAuthPack = new SafeAuthPack();
      setAuthPack(safeAuthPack);
      await safeAuthPack.init(safeAuthInitOptions);
      safeAuthPack.subscribe('accountsChanged', async (accounts) => {
        console.log(
          'safeAuthPack:accountsChanged',
          accounts,
          safeAuthPack.isAuthenticated
        );
        if (safeAuthPack.isAuthenticated) {
          const signInInfo = await authPack?.signIn();

          setSafeAuthSignInResponse(signInInfo as AuthKitSignInData);
          setIsAuthenticated(true);
        }
      });

      safeAuthPack.subscribe('chainChanged', (eventData) =>
        console.log('safeAuthPack:chainChanged', eventData)
      );
    }
    initSafeAuth();
  }, []);
  useEffect(() => {
    if (!authPack || !isAuthenticated) return;
    (async () => {
      const web3Provider = authPack.getProvider();
      const userInfo = await authPack.getUserInfo();
      setUserInfo(userInfo);

      if (web3Provider) {
        const provider = new ethers.providers.Web3Provider(web3Provider);
        const signer = await provider.getSigner();
        const signerAddress = await signer.getAddress();

        setChainId((await provider?.getNetwork()).chainId.toString());
        setProvider(provider);
      }
    })();
  }, [isAuthenticated]);
  const updateCounterValue = async () => {
    const providerRPC = new ethers.providers.JsonRpcProvider(
      'https://ethereum-sepolia.publicnode.com'
    );
    const counterContract = new Contract(
      '0x2337b268547e54a692397c3dfee7effc87f1d354', // Dirección del contrato Counter
      counterABI,
      providerRPC
    );

    try {
      const number = await counterContract.number();
      setCount(number.toString());
    } catch (error) {
      console.error('Error al leer el valor del contador:', error);
    }
  };

  useEffect(() => {
    const intervalId = setInterval(updateCounterValue, 3000); // 3000 milisegundos = 3 segundos

    return () => clearInterval(intervalId);
  }, []);
  const handleLogin = async () => {
    if (authPack) {
      const authKitSignData = await authPack.signIn();
      setSafeAuthSignInResponse(authKitSignData as AuthKitSignInData);
      setIsAuthenticated(true);
    }
  };

  const handleMakeGaslessTransaction = async () => {
    if (!authPack || !provider) return;

    try {
      const signer = provider.getSigner();
      const from = await authPack.getAddress();

      const to = '0x2337b268547e54a692397c3dfee7effc87f1d354';
      const counterContract = new Contract(to, counterABI, signer);
      const data = counterContract.interface.encodeFunctionData('increment');

      const forwarderAddress = '0x52c84c6aa1e19f311fd9ad5f227fe593852b0c03';
      const forwarderContract = new Contract(
        forwarderAddress,
        forwarderABI,
        signer
      );
      const input = { from, to, data };
      console.debug(input, signer, forwarderContract);
      const request = await signMetaTxRequest(signer, forwarderContract, input);
      fetch('/api/makeTransaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });
      console.debug('Metatransacción enviada:', request);
    } catch (error) {
      console.error('Error al realizar la metatransacción:', error);
    }
  };

  return (
    <main className='flex min-h-screen flex-col items-center justify-between p-24'>
      {isAuthenticated ? (
        <div className='w-[80vw] break-words'>
          <h1>Authenticated</h1>
        </div>
      ) : (
        <div className='w-[80vw] break-words'>
          <h1>Un-Authenticated</h1>
          <p>If this is not the first LogIn please wait a few seconds :D</p>
        </div>
      )}
      <h1>CurrentCount: {count}</h1>
      <p>Please wait a few seconds before make any action :D</p>
      <div className='flex flew-row w-full justify-center gap-10'>
        <button
          className='rounded-lg text-white bg-blue-500 p-10'
          onClick={handleLogin}
        >
          Login safe
        </button>
        {isAuthenticated && (
          <button
            className='rounded-lg text-white bg-blue-500 p-10'
            onClick={handleMakeGaslessTransaction}
          >
            Make gasless transaction
          </button>
        )}
      </div>
    </main>
  );
}
