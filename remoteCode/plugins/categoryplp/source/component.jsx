import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useSelector, shallowEqual } from 'react-redux';
import { makeBoolean, useApptileWindowDims, navigateToScreen, triggerAction } from 'apptile-core';
import { useRoute } from '@react-navigation/native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const PRODUCTS_PER_PAGE = 10;

// ── GraphQL Queries ──────────────────────────────────────────────────────────

const MENU_QUERY = `{
  menu(handle: "main-menu") {
    items {
      title
      url
      items {
        title
        url
        resourceId
        items {
          title
          url
          resourceId
        }
      }
    }
  }
}`;

const COLLECTION_PRODUCTS_QUERY = `
query CollectionProducts($handle: String!, $first: Int!, $after: String) {
  collection(handle: $handle) {
    id
    title
    image { url }
    products(first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          handle
          vendor
          priceRange {
            minVariantPrice { amount currencyCode }
          }
          images(first: 1) {
            edges { node { url altText } }
          }
          variants(first: 1) {
            edges { node { id title } }
          }
        }
      }
    }
  }
}`;

// ── API Helper ───────────────────────────────────────────────────────────────

async function storefrontFetch(apiUrl, token, query, variables = {}) {
  console.log('[categoryplp] storefrontFetch', JSON.stringify({ query: query.substring(0, 60), variables }));
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.log('[categoryplp] storefrontFetch FAILED', res.status, errBody);
    throw new Error(`Storefront API error: ${res.status}`);
  }
  const json = await res.json();
  console.log('[categoryplp] storefrontFetch OK');
  if (json.errors) {
    console.log('[categoryplp] GraphQL errors', JSON.stringify(json.errors).substring(0, 300));
    throw new Error(json.errors[0]?.message || 'GraphQL error');
  }
  return json.data;
}

function extractHandle(url) {
  if (!url) return null;
  const match = url.match(/\/collections\/([^?/]+)/);
  return match ? match[1] : null;
}

// ── Component ────────────────────────────────────────────────────────────────

export function ReactComponent({ model, dispatch }) {
  const id = model.get('id');
  const { width: screenWidth, height: windowHeight } = useApptileWindowDims();

  // ── Read storefront credentials from Redux ──
  const storefrontAccessToken = useSelector(
    state => state.appModel.values.getIn(['shopify', 'storefrontAccessToken']),
    shallowEqual
  );
  const storefrontApiUrl = useSelector(
    state => state.appModel.values.getIn(['shopify', 'storefrontApiUrl']),
    shallowEqual
  );

  // ── Read cart data from Redux ──
  const currentCart = useSelector(
    state => state.appModel.values.getIn(['shopify', 'currentCart']),
    shallowEqual
  );

  // ── Shopify config & model for triggerAction ──
  const shopifyConfig = useSelector(
    state => state.appConfig.current.getIn(['plugins', 'shopify']),
    shallowEqual
  );
  const shopifyData = useSelector(
    state => state.appModel.values.getIn(['shopify']),
    shallowEqual
  );

  // ── Read page params ──
  const route = useRoute();
  const collectionHandle = route.params?.collectionHandle || '';

  // ── Merchant config ──
  const menuHandle = model.get('menuHandle') || 'main-menu';
  const parentCategory = model.get('parentCategory') || collectionHandle || 'Alimentation';
  const bannerTitle = model.get('bannerTitle') || '';
  const bannerSubtitle = model.get('bannerSubtitle') || 'Réductions sur les fruits de saison';
  const bannerNote = model.get('bannerNote') || '*Valable jusqu\'à ce vendredi';
  const primaryColor = model.get('primaryColor') || '#3B5998';
  const priceColor = model.get('priceColor') || '#3B5998';
  const backgroundColor = model.get('backgroundColor') || '#F8F8F8';
  const cardBackgroundColor = model.get('cardBackgroundColor') || '#FFFFFF';
  const textColor = model.get('textColor') || '#222222';
  const subtitleColor = model.get('subtitleColor') || '#999999';
  const cartBarColor = model.get('cartBarColor') || '#4CAF50';
  const cartBarTextColor = model.get('cartBarTextColor') || '#FFFFFF';
  const currency = model.get('currency') || 'Dh';
  const currencySuffix = model.get('currencySuffix') || 'MAD';
  const viewCartLabel = model.get('viewCartLabel') || 'VOIR LE PANIER';
  const showBanner = makeBoolean(model.get('showBanner') ?? true);
  const showCartBar = makeBoolean(model.get('showCartBar') ?? true);
  const cardBorderRadius = parseInt(model.get('cardBorderRadius'), 10) || 12;
  const categorySize = parseInt(model.get('categorySize'), 10) || 52;

  // ── Derive cart info ──
  const cartData = useMemo(() => {
    if (!currentCart) {
      console.log('[categoryplp] cart: null');
      return null;
    }
    try {
      const cart = currentCart.toJS ? currentCart.toJS() : currentCart;
      const lines = cart.lines || [];
      const totalItems = lines.reduce((sum, l) => sum + (l.quantity || 0), 0);
      console.log('[categoryplp] cart items:', totalItems);
      if (totalItems === 0) return null;
      const thumbs = lines
        .map(l => l.variant?.featuredImage || l.variant?.image?.src || null)
        .filter(Boolean)
        .slice(0, 3);
      const variantIds = new Set(
        lines.map(l => l.variant?.id).filter(Boolean)
      );
      const cartQuantities = {};
      lines.forEach(l => {
        const vid = l.variant?.id;
        if (vid) cartQuantities[vid] = (cartQuantities[vid] || 0) + (l.quantity || 0);
      });
      return { totalItems, thumbs, variantIds, cartQuantities };
    } catch (e) {
      console.log('[categoryplp] cart parse error:', e.message);
      return null;
    }
  }, [currentCart]);

  // ── State ──
  const [categories, setCategories] = useState([]);
  const [selectedCategoryHandle, setSelectedCategoryHandle] = useState(null);
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsLoadingMore, setProductsLoadingMore] = useState(false);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState(null);
  const [productsError, setProductsError] = useState(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [endCursor, setEndCursor] = useState(null);
  const [categoryImages, setCategoryImages] = useState({});

  const flatListRef = useRef(null);

  // ── Fetch menu to build sidebar categories ──
  useEffect(() => {
    let cancelled = false;
    if (!storefrontAccessToken || !storefrontApiUrl) return;

    async function loadMenu() {
      try {
        setMenuLoading(true);
        setMenuError(null);
        const data = await storefrontFetch(storefrontApiUrl, storefrontAccessToken, MENU_QUERY);
        if (cancelled) return;

        const menuItems = data?.menu?.items || [];
        console.log('[categoryplp] collectionHandle:', collectionHandle);
        console.log('[categoryplp] parentCategory:', parentCategory);

        // Find the parent menu item:
        // 1. If collectionHandle is provided, find the parent whose sub-items contain it
        // 2. Otherwise match by parentCategory title or handle
        let parent = null;
        let preSelectHandle = null;

        if (collectionHandle) {
          for (const item of menuItems) {
            const match = (item.items || []).find(sub =>
              sub.url?.includes(`/collections/${collectionHandle}`)
            );
            if (match) {
              parent = item;
              preSelectHandle = collectionHandle;
              console.log('[categoryplp] Found parent via sub-collection:', item.title);
              break;
            }
          }
        }

        if (!parent) {
          const searchHandle = parentCategory.toLowerCase();
          parent = menuItems.find(item =>
            item.url?.includes(`/collections/${searchHandle}`) ||
            item.title === parentCategory
          );
        }

        if (!parent) {
          console.log('[categoryplp] No parent found');
          setMenuError(`Category "${parentCategory}" not found in menu`);
          setMenuLoading(false);
          return;
        }
        console.log('[categoryplp] Using parent:', parent.title);

        // Build categories from sub-items
        const cats = (parent.items || []).map(sub => ({
          title: sub.title,
          handle: extractHandle(sub.url),
          resourceId: sub.resourceId,
          subCollections: (sub.items || []).map(subsub => ({
            title: subsub.title,
            handle: extractHandle(subsub.url),
            resourceId: subsub.resourceId,
          })),
        })).filter(c => c.handle);

        setCategories(cats);

        // Select matching category from params, or first
        if (preSelectHandle && cats.some(c => c.handle === preSelectHandle)) {
          setSelectedCategoryHandle(preSelectHandle);
        } else if (cats.length > 0) {
          setSelectedCategoryHandle(cats[0].handle);
        }

        // Fetch collection images for each category
        const imageQuery = `{
          ${cats.map((c, i) => `col${i}: collection(handle: "${c.handle}") { image { url } }`).join('\n')}
        }`;
        try {
          const imgData = await storefrontFetch(storefrontApiUrl, storefrontAccessToken, imageQuery);
          if (!cancelled) {
            const imgs = {};
            cats.forEach((c, i) => {
              const url = imgData[`col${i}`]?.image?.url;
              if (url) imgs[c.handle] = url;
            });
            setCategoryImages(imgs);
          }
        } catch (_) {
          // Non-critical — sidebar works without images
        }
      } catch (e) {
        if (!cancelled) setMenuError(e.message);
      } finally {
        if (!cancelled) setMenuLoading(false);
      }
    }
    loadMenu();
    return () => { cancelled = true; };
  }, [storefrontAccessToken, storefrontApiUrl, parentCategory, collectionHandle]);

  // ── Fetch products when category changes ──
  useEffect(() => {
    let cancelled = false;
    if (!storefrontAccessToken || !storefrontApiUrl || !selectedCategoryHandle) return;

    async function loadProducts() {
      try {
        setProductsLoading(true);
        setProductsError(null);
        setProducts([]);
        setHasNextPage(false);
        setEndCursor(null);

        const data = await storefrontFetch(
          storefrontApiUrl,
          storefrontAccessToken,
          COLLECTION_PRODUCTS_QUERY,
          { handle: selectedCategoryHandle, first: PRODUCTS_PER_PAGE, after: null }
        );
        if (cancelled) return;

        const collection = data?.collection;
        if (!collection) {
          setProductsError('Collection not found');
          return;
        }

        const prods = (collection.products?.edges || []).map(e => parseProduct(e.node));
        setProducts(prods);
        setHasNextPage(collection.products?.pageInfo?.hasNextPage || false);
        setEndCursor(collection.products?.pageInfo?.endCursor || null);
      } catch (e) {
        if (!cancelled) setProductsError(e.message);
      } finally {
        if (!cancelled) setProductsLoading(false);
      }
    }
    loadProducts();
    return () => { cancelled = true; };
  }, [storefrontAccessToken, storefrontApiUrl, selectedCategoryHandle]);

  // ── Load more products (pagination) ──
  const loadMoreProducts = useCallback(async () => {
    if (!hasNextPage || productsLoadingMore || !endCursor) return;
    try {
      setProductsLoadingMore(true);
      const data = await storefrontFetch(
        storefrontApiUrl,
        storefrontAccessToken,
        COLLECTION_PRODUCTS_QUERY,
        { handle: selectedCategoryHandle, first: PRODUCTS_PER_PAGE, after: endCursor }
      );
      const collection = data?.collection;
      if (!collection) return;

      const newProds = (collection.products?.edges || []).map(e => parseProduct(e.node));
      setProducts(prev => [...prev, ...newProds]);
      setHasNextPage(collection.products?.pageInfo?.hasNextPage || false);
      setEndCursor(collection.products?.pageInfo?.endCursor || null);
    } catch (e) {
      console.log('[categoryplp] loadMore error', e.message);
    } finally {
      setProductsLoadingMore(false);
    }
  }, [hasNextPage, productsLoadingMore, endCursor, storefrontApiUrl, storefrontAccessToken, selectedCategoryHandle]);

  // ── Parse product node ──
  function parseProduct(node) {
    return {
      id: node.id,
      title: node.title,
      handle: node.handle,
      vendor: node.vendor || '',
      price: parseFloat(node.priceRange?.minVariantPrice?.amount || '0'),
      currencyCode: node.priceRange?.minVariantPrice?.currencyCode || 'MAD',
      image: node.images?.edges?.[0]?.node?.url || null,
      variantId: node.variants?.edges?.[0]?.node?.id || null,
    };
  }

  // ── Category select handler ──
  const handleCategorySelect = useCallback((handle) => {
    setSelectedCategoryHandle(handle);
    if (flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: false });
    }
  }, []);

  // ── Add to cart ──
  const handleAddToCart = useCallback((variantId) => {
    if (!shopifyConfig || !shopifyData || !variantId) return;
    dispatch(triggerAction({
      pluginConfig: shopifyConfig,
      pluginModel: shopifyData,
      pluginSelector: ['shopify'],
      eventModelJS: {
        value: 'increaseCartLineItemQuantity',
        params: {
          merchandiseId: variantId,
          quantity: 1,
          syncWithShopify: true,
          successToastText: 'Added to cart',
        },
      },
    }));
  }, [dispatch, shopifyConfig, shopifyData]);

  // ── Decrease cart quantity ──
  const handleDecreaseCart = useCallback((variantId) => {
    if (!shopifyConfig || !shopifyData || !variantId) return;
    dispatch(triggerAction({
      pluginConfig: shopifyConfig,
      pluginModel: shopifyData,
      pluginSelector: ['shopify'],
      eventModelJS: {
        value: 'decreaseCartLineItemQuantity',
        params: {
          merchandiseId: variantId,
          quantity: 1,
          syncWithShopify: true,
        },
      },
    }));
  }, [dispatch, shopifyConfig, shopifyData]);

  // ── Derived ──
  const selectedCategory = useMemo(() => {
    return categories.find(c => c.handle === selectedCategoryHandle);
  }, [categories, selectedCategoryHandle]);

  const displayBannerTitle = bannerTitle || selectedCategory?.title || parentCategory;

  // ── Layout ──
  const sidebarWidth = 80;
  const selectedCircleSize = 66;
  const normalCircleSize = categorySize;
  const circleOverflow = (selectedCircleSize - sidebarWidth) / 2 + 8;
  const productAreaLeft = 6;
  const productCardWidth = (screenWidth - sidebarWidth - productAreaLeft - 6 - 10) / 2;

  // ── Render helpers ──
  const renderCategory = useCallback((cat) => {
    const isSelected = selectedCategoryHandle === cat.handle;
    const circleSize = isSelected ? selectedCircleSize : normalCircleSize;
    const imgSize = circleSize - 6;
    const catImage = categoryImages[cat.handle];
    return (
      <TouchableOpacity
        key={cat.handle}
        style={[
          styles.categoryItem,
          isSelected && {
            borderLeftColor: primaryColor,
            borderLeftWidth: 3,
            backgroundColor: '#FFFFFF',
          },
        ]}
        onPress={() => handleCategorySelect(cat.handle)}
        activeOpacity={0.7}
      >
        <View style={[
          styles.categoryImageOuter,
          {
            width: circleSize,
            height: circleSize,
            borderRadius: circleSize / 2,
            borderWidth: isSelected ? 2.5 : 0,
            borderColor: isSelected ? primaryColor : 'transparent',
            backgroundColor: catImage ? '#FFFFFF' : '#E0E0E0',
            right: isSelected ? -circleOverflow : 0,
            elevation: isSelected ? 4 : 0,
            shadowOpacity: isSelected ? 0.15 : 0,
          },
        ]}>
          {catImage ? (
            <Image
              source={{ uri: catImage }}
              style={{
                width: imgSize,
                height: imgSize,
                borderRadius: imgSize / 2,
              }}
              resizeMode="cover"
            />
          ) : (
            <Text style={{ fontSize: 18 }}>
              {cat.title.charAt(0)}
            </Text>
          )}
        </View>
        <Text
          style={[
            styles.categoryName,
            {
              color: isSelected ? primaryColor : '#555555',
              fontWeight: isSelected ? '700' : '500',
            },
          ]}
          numberOfLines={2}
        >
          {cat.title}
        </Text>
      </TouchableOpacity>
    );
  }, [selectedCategoryHandle, primaryColor, normalCircleSize, selectedCircleSize, circleOverflow, categoryImages, handleCategorySelect]);

  const CARD_HEIGHT = 260;

  const renderProduct = useCallback(({ item }) => {
    const isInCart = cartData?.variantIds?.has(item.variantId);
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => dispatch(navigateToScreen('Product', { productHandle: item.handle }))}
        style={[
          styles.productCard,
          {
            width: productCardWidth,
            height: CARD_HEIGHT,
            backgroundColor: cardBackgroundColor,
            borderRadius: cardBorderRadius,
          },
        ]}
      >
        {/* Image area — fixed height */}
        <View style={[styles.productImageContainer, { borderTopLeftRadius: cardBorderRadius, borderTopRightRadius: cardBorderRadius }]}>
          {item.image ? (
            <Image
              source={{ uri: item.image }}
              style={styles.productImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.productImagePlaceholder}>
              <Text style={{ fontSize: 12, color: '#BBBBBB' }}>No image</Text>
            </View>
          )}
        </View>

        {/* Separator line */}
        <View style={styles.productDivider} />

        {/* Text content — flex:1 pushes footer to bottom */}
        <View style={styles.productInfo}>
          <Text style={[styles.productBrand, { color: subtitleColor }]} numberOfLines={1}>
            {item.vendor}
          </Text>
          <Text style={[styles.productName, { color: textColor }]} numberOfLines={2}>
            {item.title}
          </Text>
        </View>

        {/* Footer: price left, add/qty right — always at bottom */}
        <View style={styles.productFooter}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.productPrice, { color: priceColor }]} numberOfLines={1}>
              {item.price.toFixed(2)}
            </Text>
            <Text style={[styles.productCurrency, { color: priceColor }]}>
              {currencySuffix}
            </Text>
          </View>
          {isInCart ? (
            <View style={[styles.qtyStepper, { backgroundColor: '#d4e4fc' }]}>
              <TouchableOpacity
                style={styles.qtyBtn}
                activeOpacity={0.7}
                onPress={(e) => { e.stopPropagation(); handleDecreaseCart(item.variantId); }}
              >
                <Text style={styles.qtyBtnText}>{'\u2212'}</Text>
              </TouchableOpacity>
              <View style={styles.qtyValueWrap}>
                <Text style={styles.qtyValue}>
                  {cartData?.cartQuantities?.[item.variantId] || 1}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.qtyBtn}
                activeOpacity={0.7}
                onPress={(e) => { e.stopPropagation(); handleAddToCart(item.variantId); }}
              >
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: '#2b5a9e' }]}
              activeOpacity={0.7}
              onPress={(e) => { e.stopPropagation(); handleAddToCart(item.variantId); }}
            >
              <Text style={styles.addButtonPlus}>+</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [
    productCardWidth, cardBackgroundColor, cardBorderRadius,
    textColor, subtitleColor, priceColor, primaryColor, cartBarColor, currency, currencySuffix,
    handleAddToCart, handleDecreaseCart, cartData, dispatch,
  ]);

  const renderFooter = useCallback(() => {
    if (!productsLoadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={primaryColor} />
      </View>
    );
  }, [productsLoadingMore, primaryColor]);

  const hasCart = showCartBar && cartData && cartData.totalItems > 0;
  const cartBarHeight = hasCart ? 60 : 0;
  const bannerHeight = showBanner ? 100 : 0;
  const contentHeight = windowHeight - bannerHeight - cartBarHeight - 24;

  // ── Early returns AFTER all hooks ──
  if (!storefrontAccessToken || !storefrontApiUrl) {
    return (
      <View nativeID={'rootElement-' + id} style={[styles.root, styles.centered]}>
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={styles.loadingText}>Loading store configuration...</Text>
      </View>
    );
  }

  if (menuLoading) {
    return (
      <View nativeID={'rootElement-' + id} style={[styles.root, styles.centered]}>
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={styles.loadingText}>Loading categories...</Text>
      </View>
    );
  }

  if (menuError) {
    return (
      <View nativeID={'rootElement-' + id} style={[styles.root, styles.centered]}>
        <Text style={styles.errorText}>{menuError}</Text>
      </View>
    );
  }

  // ── Main Render ──
  return (
    <View
      nativeID={'rootElement-' + id}
      style={[styles.root, { backgroundColor, height: windowHeight }]}
    >
      {/* Banner */}
      {showBanner && (
        <View style={[styles.banner, { backgroundColor: primaryColor, borderRadius: cardBorderRadius }]}>
          <View style={styles.bannerContent}>
            <Text style={styles.bannerTitle}>{displayBannerTitle}</Text>
            <View style={styles.bannerSubRow}>
              <View style={styles.bannerBadge}>
                <Text style={styles.bannerBadgeText}>%</Text>
              </View>
              <View style={styles.bannerTextCol}>
                <Text style={styles.bannerSubtitle}>{bannerSubtitle}</Text>
                <Text style={styles.bannerNote}>{bannerNote}</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Main content: fixed sidebar + scrollable product grid */}
      <View style={[styles.mainContent, { height: contentHeight }]}>
        {/* Fixed category sidebar */}
        <View style={[styles.sidebarContainer, { width: sidebarWidth }]}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sidebarContent}
            style={styles.sidebarScroll}
            nestedScrollEnabled
          >
            {categories.map(renderCategory)}
          </ScrollView>
        </View>

        {/* Scrollable product grid */}
        <View style={[styles.productArea, { marginLeft: productAreaLeft }]}>
          {productsLoading ? (
            <View style={styles.productLoaderWrap}>
              <ActivityIndicator size="large" color={primaryColor} />
            </View>
          ) : productsError ? (
            <View style={styles.productLoaderWrap}>
              <Text style={styles.errorText}>{productsError}</Text>
            </View>
          ) : products.length === 0 ? (
            <View style={styles.productLoaderWrap}>
              <Text style={styles.emptyText}>No products found</Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={products}
              renderItem={renderProduct}
              keyExtractor={item => item.id}
              numColumns={2}
              columnWrapperStyle={styles.productRow}
              contentContainerStyle={[
                styles.productListContent,
                { paddingBottom: 100 },
              ]}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              onEndReached={loadMoreProducts}
              onEndReachedThreshold={0.4}
              ListFooterComponent={renderFooter}
            />
          )}
        </View>
      </View>

      {/* Floating cart pill */}
      {hasCart && (
        <View style={[styles.cartBarOuter, { top: 686 }]}>
          <TouchableOpacity
            style={styles.cartBar}
            activeOpacity={0.8}
            onPress={() => dispatch(navigateToScreen('Cart'))}
          >
            {/* Overlapping thumbnails */}
            <View style={styles.cartBarThumbs}>
              {cartData.thumbs.map((uri, i) => (
                <View
                  key={i}
                  style={[
                    styles.cartBarThumbWrap,
                    { marginLeft: i === 0 ? 0 : -8, zIndex: 3 - i },
                  ]}
                >
                  <Image
                    source={{ uri }}
                    style={styles.cartBarThumbImg}
                    resizeMode="cover"
                  />
                </View>
              ))}
            </View>

            {/* View Cart text */}
            <View style={styles.cartBarTextWrap}>
              <Text style={[styles.cartBarTitle, { color: textColor }]}>
                View Cart
              </Text>
              <Text style={[styles.cartBarSubtitle, { color: subtitleColor }]}>
                {cartData.totalItems} Item{cartData.totalItems > 1 ? 's' : ''}
              </Text>
            </View>

            {/* Chevron arrow */}
            <View style={[styles.cartBarChevron, { backgroundColor: primaryColor }]}>
              <Text style={styles.cartBarChevronText}>{'\u203A'}</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 'unset',
    minHeight: 500,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#888888',
  },
  errorText: {
    fontSize: 13,
    color: '#CC3333',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 13,
    color: '#888888',
    textAlign: 'center',
  },

  // Banner
  banner: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    overflow: 'hidden',
  },
  bannerContent: {
    flexDirection: 'column',
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  bannerSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF30',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  bannerBadgeText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  bannerTextCol: {
    flex: 1,
  },
  bannerSubtitle: {
    color: '#FFFFFFDD',
    fontSize: 12,
    fontWeight: '500',
  },
  bannerNote: {
    color: '#FFFFFFAA',
    fontSize: 10,
    marginTop: 2,
  },

  // Main content
  mainContent: {
    flexDirection: 'row',
    overflow: 'hidden',
  },

  // Fixed sidebar
  sidebarContainer: {
    backgroundColor: '#F0F0F0',
    zIndex: 2,
    overflow: 'visible',
  },
  sidebarScroll: {
    overflow: 'visible',
  },
  sidebarContent: {
    paddingVertical: 6,
    overflow: 'visible',
  },
  categoryItem: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
    overflow: 'visible',
  },
  categoryImageOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  categoryName: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 13,
    paddingHorizontal: 2,
  },

  // Product area
  productArea: {
    flex: 1,
    paddingRight: 6,
    zIndex: 1,
  },
  productLoaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  productListContent: {
    paddingTop: 4,
  },
  productRow: {
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  productCard: {
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  productImageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    height: 120,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  productDivider: {
    height: 1,
    backgroundColor: '#E8E8E8',
  },
  productInfo: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 4,
  },
  productBrand: {
    fontSize: 11,
    fontWeight: '400',
    marginBottom: 3,
  },
  productName: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
    marginBottom: 4,
  },
  productFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 4,
  },
  productPrice: {
    fontSize: 11,
    fontWeight: '700',
  },
  productCurrency: {
    fontSize: 9,
    fontWeight: '400',
    opacity: 0.7,
  },
  addButton: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonPlus: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: -1,
  },
  cartDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EE4444',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  qtyStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    height: 30,
    overflow: 'hidden',
  },
  qtyBtn: {
    width: 26,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2b5a9e',
  },
  qtyValueWrap: {
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2b5a9e',
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },

  // Cart bar
  cartBarOuter: {
    position: 'absolute',
    left: 30,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  cartBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    paddingLeft: 6,
    paddingRight: 8,
    paddingVertical: 6,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  cartBarThumbs: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  cartBarThumbWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#F2F2F2',
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cartBarThumbImg: {
    width: '100%',
    height: '100%',
  },
  cartBarTextWrap: {
    marginRight: 14,
  },
  cartBarTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  cartBarSubtitle: {
    fontSize: 11,
    fontWeight: '400',
    marginTop: 1,
  },
  cartBarChevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBarChevronText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '400',
    marginTop: -2,
  },
});

// ── Exports ──────────────────────────────────────────────────────────────────

export const WidgetConfig = {
  parentCategory: 'Alimentation',
  bannerTitle: '',
  bannerSubtitle: 'Réductions sur les fruits de saison',
  bannerNote: '*Valable jusqu\'à ce vendredi',
  primaryColor: '#3B5998',
  priceColor: '#3B5998',
  backgroundColor: '#F8F8F8',
  cardBackgroundColor: '#FFFFFF',
  textColor: '#222222',
  subtitleColor: '#999999',
  cartBarColor: '#4CAF50',
  cartBarTextColor: '#FFFFFF',
  currency: 'Dh',
  currencySuffix: 'MAD',
  viewCartLabel: 'VOIR LE PANIER',
  showBanner: true,
  showCartBar: true,
  cardBorderRadius: 12,
  categorySize: 52,
};

export const WidgetEditors = {
  basic: [
    { type: 'codeInput', name: 'parentCategory', props: { label: 'Parent Menu Category', singleLine: true } },
    { type: 'codeInput', name: 'bannerTitle', props: { label: 'Banner Title (blank = category name)', singleLine: true } },
    { type: 'codeInput', name: 'bannerSubtitle', props: { label: 'Banner Subtitle', singleLine: true } },
    { type: 'codeInput', name: 'bannerNote', props: { label: 'Banner Note', singleLine: true } },
    { type: 'checkbox', name: 'showBanner', props: { label: 'Show Banner' } },
    { type: 'checkbox', name: 'showCartBar', props: { label: 'Show Cart Bar' } },
    { type: 'codeInput', name: 'currency', props: { label: 'Currency Symbol', singleLine: true } },
    { type: 'codeInput', name: 'currencySuffix', props: { label: 'Currency Suffix', singleLine: true } },
    { type: 'codeInput', name: 'viewCartLabel', props: { label: 'View Cart Label', singleLine: true } },
    { type: 'numericInput', name: 'cardBorderRadius', props: { label: 'Card Border Radius', unit: 'px' } },
    { type: 'numericInput', name: 'categorySize', props: { label: 'Category Image Size', unit: 'px' } },
    { type: 'colorInput', name: 'primaryColor', props: { label: 'Primary Color' } },
    { type: 'colorInput', name: 'priceColor', props: { label: 'Price Color' } },
    { type: 'colorInput', name: 'backgroundColor', props: { label: 'Background Color' } },
    { type: 'colorInput', name: 'cardBackgroundColor', props: { label: 'Card Background' } },
    { type: 'colorInput', name: 'textColor', props: { label: 'Text Color' } },
    { type: 'colorInput', name: 'subtitleColor', props: { label: 'Subtitle Color' } },
    { type: 'colorInput', name: 'cartBarColor', props: { label: 'Cart Bar Color' } },
    { type: 'colorInput', name: 'cartBarTextColor', props: { label: 'Cart Bar Text Color' } },
  ],
};

export const PropertySettings = {};

export const WrapperTileConfig = {
  name: 'Category PLP',
  defaultProps: {},
};
