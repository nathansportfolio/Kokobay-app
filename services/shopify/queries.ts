/** Storefront GraphQL operations — version path set in `client.ts` */

export const GET_COLLECTIONS = /* GraphQL */ `
  query GetCollections($first: Int!) {
    collections(first: $first) {
      edges {
        node {
          id
          handle
          title
          description
          descriptionHtml
          image {
            id
            url
            altText
            width
            height
          }
        }
      }
    }
  }
`;

export const GET_COLLECTION_WITH_PRODUCTS = /* GraphQL */ `
  query GetCollectionWithProducts($handle: String!, $first: Int!, $country: CountryCode)
    @inContext(country: $country) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      descriptionHtml
      image {
        id
        url
        altText
        width
        height
      }
      products(first: $first, sortKey: CREATED, reverse: true) {
        edges {
          node {
            id
            handle
            title
            description
            descriptionHtml
            availableForSale
            vendor
            productType
            tags
            images(first: 20) {
              edges {
                node {
                  id
                  url
                  altText
                  width
                  height
                }
              }
            }
            variants(first: 50) {
              edges {
                node {
                  id
                  title
                  availableForSale
                  price {
                    amount
                    currencyCode
                  }
                  compareAtPrice {
                    amount
                    currencyCode
                  }
                  selectedOptions {
                    name
                    value
                  }
                  image {
                    id
                    url
                    altText
                    width
                    height
                  }
                }
              }
            }
            priceRange {
              minVariantPrice {
                amount
                currencyCode
              }
              maxVariantPrice {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }
  }
`;

export const GET_PRODUCT_BY_HANDLE = /* GraphQL */ `
  query GetProductByHandle($handle: String!, $country: CountryCode) @inContext(country: $country) {
    product(handle: $handle) {
      id
      handle
      title
      description
      descriptionHtml
      availableForSale
      vendor
      productType
      tags
      images(first: 20) {
        edges {
          node {
            id
            url
            altText
            width
            height
          }
        }
      }
      variants(first: 50) {
        edges {
          node {
            id
            title
            availableForSale
            price {
              amount
              currencyCode
            }
            compareAtPrice {
              amount
              currencyCode
            }
            selectedOptions {
              name
              value
            }
            image {
              id
              url
              altText
              width
              height
            }
          }
        }
      }
      priceRange {
        minVariantPrice {
          amount
          currencyCode
        }
        maxVariantPrice {
          amount
          currencyCode
        }
      }
    }
  }
`;

/** Wildcard catalog list — newest products first (`CREATED` desc). */
export const LIST_PRODUCTS_NEWEST_FIRST = /* GraphQL */ `
  query ListProductsNewestFirst($first: Int!, $country: CountryCode) @inContext(country: $country) {
    products(first: $first, query: "*", sortKey: CREATED_AT, reverse: true) {
      edges {
        node {
          id
          handle
          title
          description
          descriptionHtml
          availableForSale
          vendor
          productType
          tags
          images(first: 10) {
            edges {
              node {
                id
                url
                altText
                width
                height
              }
            }
          }
          variants(first: 25) {
            edges {
              node {
                id
                title
                availableForSale
                price {
                  amount
                  currencyCode
                }
                compareAtPrice {
                  amount
                  currencyCode
                }
                selectedOptions {
                  name
                  value
                }
                image {
                  id
                  url
                  altText
                  width
                  height
                }
              }
            }
          }
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
            maxVariantPrice {
              amount
              currencyCode
            }
          }
        }
      }
    }
  }
`;

export const SEARCH_PRODUCTS = /* GraphQL */ `
  query SearchProducts($query: String!, $first: Int!, $country: CountryCode)
    @inContext(country: $country) {
    products(first: $first, query: $query) {
      edges {
        node {
          id
          handle
          title
          description
          descriptionHtml
          availableForSale
          vendor
          productType
          tags
          images(first: 10) {
            edges {
              node {
                id
                url
                altText
                width
                height
              }
            }
          }
          variants(first: 25) {
            edges {
              node {
                id
                title
                availableForSale
                price {
                  amount
                  currencyCode
                }
                compareAtPrice {
                  amount
                  currencyCode
                }
                selectedOptions {
                  name
                  value
                }
                image {
                  id
                  url
                  altText
                  width
                  height
                }
              }
            }
          }
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
            maxVariantPrice {
              amount
              currencyCode
            }
          }
        }
      }
    }
  }
`;

const CART_FIELDS = /* GraphQL */ `
  fragment CartFields on Cart {
    id
    checkoutUrl
    totalQuantity
    cost {
      subtotalAmount {
        amount
        currencyCode
      }
      totalAmount {
        amount
        currencyCode
      }
      totalTaxAmount {
        amount
        currencyCode
      }
    }
    lines(first: 100) {
      edges {
        node {
          id
          quantity
          merchandise {
            ... on ProductVariant {
              id
              title
              image {
                url
                altText
              }
              price {
                amount
                currencyCode
              }
              product {
                handle
                title
              }
            }
          }
        }
      }
    }
  }
`;

export const GET_CART = /* GraphQL */ `
  ${CART_FIELDS}
  query GetCart($cartId: ID!) {
    cart(id: $cartId) {
      ...CartFields
    }
  }
`;

export const CART_CREATE = /* GraphQL */ `
  ${CART_FIELDS}
  mutation CartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        ...CartFields
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const CART_LINES_ADD = /* GraphQL */ `
  ${CART_FIELDS}
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart {
        ...CartFields
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const CART_LINES_UPDATE = /* GraphQL */ `
  ${CART_FIELDS}
  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart {
        ...CartFields
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const CART_LINES_REMOVE = /* GraphQL */ `
  ${CART_FIELDS}
  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart {
        ...CartFields
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const GET_LOCALIZATION = /* GraphQL */ `
  query Localization {
    localization {
      country {
        isoCode
        name
        currency {
          isoCode
          name
          symbol
        }
      }
      availableCountries {
        isoCode
        name
        currency {
          isoCode
          name
          symbol
        }
      }
    }
  }
`;
