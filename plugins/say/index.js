module.exports = function(){

    this.name = 'say';
    this.displayname = 'Say';
    this.description = 'Make woodhouse say things back to you';

    this.init = function(){
        var self = this;
        this.listen('say (.+?)', function(from, interface, params){
            self.sendMessage(params[0], interface, from);
        })

        this.listen('who steals cars\\?', function(from, interface){
            self.sendMessage('GYPPOS!', interface, from);
        })

    }

    return this;
}
