import React, { Component, createElement } from "react"
import hoistStatics from "hoist-non-react-statics"
import * as PropTypes from "./propTypes"
import { observer } from "./observer"
import { isStateless } from "./utils/utils"
import { MobXProviderContext } from "./Provider"

/**
 * Store Injection
 */
function createStoreInjector(grabStoresFn, component, injectNames, makeReactive) {
    let displayName =
        "inject-" +
        (component.displayName ||
            component.name ||
            (component.constructor && component.constructor.name) ||
            "Unknown")
    if (injectNames) displayName += "-with-" + injectNames

    class Injector extends Component {
        static contextType = MobXProviderContext
        static isMobxInjector = true

        render() {
            // Optimization: it might be more efficient to apply the mapper function *outside* the render method
            // (if the mapper is a function), that could avMobXProviderContextoid expensive(?) re-rendering of the injector component
            // See this test: 'using a custom injector is not too reactive' in inject.js
            const { forwardRef, ...props } = this.props

            Object.assign(props, grabStoresFn(this.context || {}, props, this.context) || {})

            if (forwardRef && !isStateless(component)) {
                props.ref = this.props.forwardRef
            }

            return createElement(component, props)
        }
    }
    if (makeReactive) Injector = observer(Injector)

    // Support forward refs
    const InjectHocRef = React.forwardRef((props, ref) =>
        React.createElement(Injector, { ...props, forwardRef: ref })
    )
    // Static fields from component should be visible on the generated Injector
    hoistStatics(InjectHocRef, component)
    InjectHocRef.wrappedComponent = component
    InjectHocRef.displayName = displayName
    return InjectHocRef
}

function grabStoresByName(storeNames) {
    return function(baseStores, nextProps) {
        storeNames.forEach(function(storeName) {
            if (
                storeName in nextProps // prefer props over stores
            )
                return
            if (!(storeName in baseStores))
                throw new Error(
                    "MobX injector: Store '" +
                        storeName +
                        "' is not available! Make sure it is provided by some Provider"
                )
            nextProps[storeName] = baseStores[storeName]
        })
        return nextProps
    }
}

/**
 * higher order component that injects stores to a child.
 * takes either a varargs list of strings, which are stores read from the context,
 * or a function that manually maps the available stores from the context to props:
 * storesToProps(mobxStores, props, context) => newProps
 */
export default function inject(/* fn(stores, nextProps) or ...storeNames */ ...storeNames) {
    let grabStoresFn
    if (typeof arguments[0] === "function") {
        grabStoresFn = arguments[0]
        return componentClass =>
            createStoreInjector(grabStoresFn, componentClass, grabStoresFn.name, true)
    } else {
        return componentClass =>
            createStoreInjector(
                grabStoresByName(storeNames),
                componentClass,
                storeNames.join("-"),
                false
            )
    }
}
