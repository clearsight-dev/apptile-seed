
export const AppEventsLogger = {
  AppEventParams: {
    AppEventParams: {},
    Content: {},
    Currency: {},
    NumItems: {},
    SearchString: {},
    ContentID: {}
  }, 
  AppEvents: {
    AddedToCart: {},
    InitiatedCheckout: {},
    Purchased: {},
    Searched: {},
    ViewedContent: {},
    AddedToWishlist: {}
  },
  logEvent: () => console.log('subbed facebook logEvent')
};
export default {};
