import React from 'react'
import parsePhoneNumberFromString, { AsYouType } from 'libphonenumber-js'
import { MuiTelInputContinent } from '@shared/constants/continents'
import { COUNTRIES, MuiTelInputCountry } from '@shared/constants/countries'
import { matchIsArray } from '@shared/helpers/array'
import {
  getCallingCodeOfCountry,
  matchContinentsIncludeCountry
} from '@shared/helpers/country'
import { isValidExtension } from '@shared/helpers/ext'
import { removeOccurrence } from '@shared/helpers/string'
import { MuiTelInputInfo, MuiTelInputReason } from '../../index.types'

type UsePhoneDigitsParams = {
  value: string
  onChange?: (value: string, info: MuiTelInputInfo) => void
  defaultCountry?: MuiTelInputCountry
  forceCallingCode: boolean
  disableFormatting: boolean
  excludedCountries?: MuiTelInputCountry[]
  onlyCountries?: MuiTelInputCountry[]
  continents?: MuiTelInputContinent[]
}

type State = {
  inputValue: string
  isoCode: MuiTelInputCountry | null
  extensionValue: string | null
}

type GetInitialStateParams = {
  defaultCountry?: MuiTelInputCountry
  initialValue: string
  forceCallingCode: boolean
  disableFormatting: boolean
}

export function getInitialState(params: GetInitialStateParams): State {
  const { defaultCountry, initialValue, disableFormatting, forceCallingCode } =
    params

  const fallbackValue = defaultCountry
    ? `+${COUNTRIES[defaultCountry]?.[0] as string}`
    : ''

  const asYouType = new AsYouType(defaultCountry)
  let inputValue = asYouType.input(initialValue)

  const ext = parsePhoneNumberFromString(initialValue, defaultCountry)?.ext

  if (forceCallingCode && inputValue === '+' && defaultCountry) {
    inputValue = `+${COUNTRIES[defaultCountry]?.[0] as string}`
  }

  const phoneNumberValue = asYouType.getNumberValue()

  if (disableFormatting && phoneNumberValue) {
    inputValue = phoneNumberValue
  }

  return {
    inputValue: inputValue || fallbackValue,
    isoCode: asYouType.getCountry() || defaultCountry || null,
    extensionValue: ext || null
  }
}

type Filters = {
  excludedCountries?: MuiTelInputCountry[]
  onlyCountries?: MuiTelInputCountry[]
  continents?: MuiTelInputContinent[]
}

function matchIsIsoCodeAccepted(
  isoCode: MuiTelInputCountry,
  filters: Filters
): boolean {
  const { excludedCountries, onlyCountries, continents } = filters

  if (
    matchIsArray(excludedCountries, true) &&
    excludedCountries.includes(isoCode)
  ) {
    return false
  }

  if (matchIsArray(onlyCountries) && !onlyCountries.includes(isoCode)) {
    return false
  }

  if (
    matchIsArray(continents) &&
    !matchContinentsIncludeCountry(continents, isoCode)
  ) {
    return false
  }

  return true
}

export default function usePhoneDigits({
  value,
  onChange,
  defaultCountry,
  onlyCountries,
  excludedCountries,
  continents,
  disableFormatting,
  forceCallingCode
}: UsePhoneDigitsParams) {
  const previousCountryRef = React.useRef<MuiTelInputCountry | null>(
    defaultCountry || null
  )
  const asYouTypeRef = React.useRef<AsYouType>(new AsYouType(defaultCountry))
  const inputRef = React.useRef<HTMLInputElement>(null)
  const extensionInputRef = React.useRef<HTMLInputElement>(null)

  const [previousDefaultCountry, setPreviousDefaultCountry] = React.useState<
    MuiTelInputCountry | undefined
  >(defaultCountry)

  const [state, setState] = React.useState<State>(() => {
    return getInitialState({
      initialValue: value,
      defaultCountry,
      disableFormatting,
      forceCallingCode
    })
  })

  const [previousValue, setPreviousValue] = React.useState(value)

  const buildOnChangeInfo = React.useCallback(
    (reason: MuiTelInputReason): MuiTelInputInfo => {
      return {
        countryCallingCode: asYouTypeRef.current.getCallingCode() || null,
        countryCode: asYouTypeRef.current.getCountry() || null,
        nationalNumber: asYouTypeRef.current.getNationalNumber(),
        extension: state.extensionValue || null,
        numberType: asYouTypeRef.current.getNumber()?.getType() ?? null,
        numberValue: asYouTypeRef.current.getNumberValue() || null,
        reason
      }
    },
    [state.extensionValue]
  )

  const matchIsIsoCodeValid = (isoCode: MuiTelInputCountry | null) => {
    return (
      isoCode &&
      matchIsIsoCodeAccepted(isoCode, {
        onlyCountries,
        excludedCountries,
        continents
      })
    )
  }

  const typeNewValue = (inputValue: string): string => {
    asYouTypeRef.current.reset()

    return asYouTypeRef.current.input(inputValue)
  }

  const makeSureStartWithPlusOrEmpty = (inputValue: string): string => {
    return inputValue.startsWith('+') || inputValue === ''
      ? inputValue
      : `+${inputValue}`
  }

  const makeSureStartWithPlusIsoCode = (
    inputValue: string,
    country: MuiTelInputCountry
  ): string => {
    return `+${getCallingCodeOfCountry(country)}${inputValue}`
  }

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const inputValue = forceCallingCode
      ? makeSureStartWithPlusIsoCode(
          event.target.value,
          state.isoCode as MuiTelInputCountry
        )
      : makeSureStartWithPlusOrEmpty(event.target.value)

    // formatted : e.g: +33 6 26 92..
    const formattedValue = typeNewValue(inputValue)
    const newCountryCode = asYouTypeRef.current.getCountry()
    const country = forceCallingCode
      ? // always the same country, can't change
        (state.isoCode as MuiTelInputCountry)
      : newCountryCode || previousCountryRef.current
    // Not formatted : e.g: +336269226..
    const numberValue = asYouTypeRef.current.getNumberValue() || ''

    previousCountryRef.current = country

    const phoneInfo = buildOnChangeInfo('input')

    // Check if the country is excluded, or not part on onlyCountries, etc..
    if (numberValue && (!country || !matchIsIsoCodeValid(country))) {
      onChange?.(numberValue, {
        ...phoneInfo,
        // we show the input value but without any formatting, or country..
        countryCode: null,
        countryCallingCode: null,
        nationalNumber: null
      })
      setPreviousValue(numberValue)
      setState({
        isoCode: null,
        inputValue: numberValue,
        extensionValue: null
      })
    } else {
      const valueToSet = disableFormatting ? numberValue : formattedValue
      onChange?.(valueToSet, phoneInfo)
      setPreviousValue(valueToSet)
      setState({
        isoCode: country,
        inputValue: valueToSet,
        extensionValue: phoneInfo.extension
      })
    }
  }

  React.useEffect(() => {
    if (value !== previousValue) {
      setPreviousValue(value)
      const newState = getInitialState({
        initialValue: value,
        defaultCountry,
        forceCallingCode,
        disableFormatting
      })
      previousCountryRef.current = newState.isoCode
      setState(newState)
    }
  }, [
    value,
    previousValue,
    defaultCountry,
    forceCallingCode,
    disableFormatting
  ])

  React.useEffect(() => {
    if (defaultCountry !== previousDefaultCountry) {
      setPreviousDefaultCountry(defaultCountry)
      asYouTypeRef.current = new AsYouType(defaultCountry)
      const { inputValue, isoCode, extensionValue } = getInitialState({
        initialValue: '',
        defaultCountry,
        forceCallingCode,
        disableFormatting
      })
      setPreviousValue(inputValue)
      asYouTypeRef.current.input(inputValue)
      previousCountryRef.current = asYouTypeRef.current.getCountry() || null
      onChange?.(inputValue, buildOnChangeInfo('country'))
      setState({
        inputValue,
        isoCode,
        extensionValue
      })
    }
  }, [
    defaultCountry,
    previousDefaultCountry,
    onChange,
    forceCallingCode,
    disableFormatting,
    buildOnChangeInfo
  ])

  const onCountryChange = (newCountry: MuiTelInputCountry): void => {
    if (newCountry === state.isoCode) {
      return
    }

    const callingCode = COUNTRIES[newCountry]?.[0] as string
    const { inputValue, isoCode } = state
    const inputValueWithoutCallingCode = isoCode
      ? removeOccurrence(inputValue, `+${getCallingCodeOfCountry(isoCode)}`)
      : inputValue

    // replace the old calling code with the new one, keeping the rest of the number
    let newValue = `+${callingCode}${inputValueWithoutCallingCode}`

    if (!disableFormatting) {
      newValue = typeNewValue(newValue)
    }

    onChange?.(newValue, {
      ...buildOnChangeInfo('country'),
      // Some country have the same calling code, so we choose what the user has selected
      countryCode: newCountry
    })

    previousCountryRef.current = newCountry
    setPreviousValue(newValue)
    setState((prev) => {
      return {
        ...prev,
        isoCode: newCountry,
        inputValue: newValue
      }
    })
  }

  const onExtensionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const extInputVal = event.target.value

    // do not allow user to enter invalid characters
    if (!isValidExtension(extInputVal)) return

    setState((prev) => {
      return { ...prev, extensionValue: extInputVal }
    })

    const { inputValue } = state
    onChange?.(inputValue, {
      ...buildOnChangeInfo('extension'),
      extension: extInputVal
    })
  }

  return {
    inputValue: state.inputValue,
    isoCode: state.isoCode,
    extensionValue: state.extensionValue,
    onInputChange,
    onCountryChange,
    onExtensionChange,
    inputRef,
    extensionInputRef
  }
}
