import ERC_20 from "../constants/abis/erc20.json"
import LP_TOKEN_UNGUARDED from "../constants/abis/lpTokenUnguarded.json"
import { Multicall } from "ethereum-multicall"
import { ethers } from "ethers"

//we need to disable all unsafe protections for any types
//because all returns from this lib are generic

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */

interface ReturnValues {
  [index: string]: any
}

class MethodBase {
  reference: string
  methodName: string
  methodParameters: any[]

  constructor(reference: string, methodName: string, methodParameters: any[]) {
    this.reference = reference
    this.methodName = methodName
    this.methodParameters = methodParameters
  }
}

class ContractCall {
  contractAddress: string
  reference: string
  abi: any[]
  calls: MethodBase[] = []

  constructor(address: string, abi: any[], calls?: MethodBase[]) {
    this.reference = address
    this.contractAddress = address
    this.abi = abi

    if (calls) {
      this.calls = calls
    }
  }

  setCall(methodName: string, methodParams: any[], methodId = ""): void {
    const call = new MethodBase(
      `${methodName}${methodId}`,
      methodName,
      methodParams,
    )

    this.calls.push(call)
  }
}

//contract array should be provided with
// [ {reference: string, contractCalls: [ {reference: string, methodName: string, methodParameters: any}, ... ], abi: []}, ... ]
async function getMultiContractData(
  provider: ethers.providers.BaseProvider,
  contractArray: ContractCall[],
): Promise<ReturnValues> {
  const multicall = new Multicall({ ethersProvider: provider })
  const call = await multicall.call(contractArray)

  const resultSet = {} as ReturnValues

  const contractNames = Object.keys(call.results)
  contractNames.forEach((name) => {
    const result = {} as ReturnValues
    call.results[name].callsReturnContext.forEach((values) => {
      //I don`t want an array when the result is not an array
      if (values.returnValues.length > 1) {
        result[values.reference] = convertMBNtoEthersBN(values.returnValues)
      } else if (values.returnValues.length === 1) {
        result[values.reference] = convertMBNtoEthersBN(values.returnValues)[0]
      } else {
        throw new Error("Return not found!")
      }
    })
    resultSet[name] = result
  })

  //result is [contractName: [ result1,... ],...]
  //result1 = { call: [return] }
  return resultSet
}

//convert Multicall BN to Ethers BN
function convertMBNtoEthersBN(retArray: ReturnValues) {
  return retArray.map((ret: any) => {
    if (ret.type === "BigNumber") {
      return ethers.BigNumber.from(ret)
    }
    return ret
  })
}

function getPoolsTVL(addr: string): ContractCall {
  const contractCall = new ContractCall(addr, LP_TOKEN_UNGUARDED)
  contractCall.setCall("totalSupply", [])

  return contractCall
}

function getUserBalance(account: string, tokenAddress: string): ContractCall {
  const contractCall = new ContractCall(tokenAddress, ERC_20)
  contractCall.setCall("balanceOf", [account])

  return contractCall
}

export { ContractCall, getMultiContractData, getPoolsTVL, getUserBalance }
