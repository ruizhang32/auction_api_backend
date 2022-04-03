type Auction = {
    auctionId: number,
    title:string,
    categoryId: number,
    sellerId:number,
    sellerFirstName:string,
    sellerLastName:string,
    reserve:number,
    numBids: number
    highestBid: number,
    end_date: Date,
    description:string,
}